// One-command local app with Connections added alongside the original ERP.
// Existing .env files are preserved; only their ERP database URL is consulted.
// Experimental integration storage always uses a separate loopback database.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const local = process.env.SMARTERP_LOCAL_DIR ?? join(root, '.local');
const dbPort = Number(process.env.SMARTERP_LOCAL_DB_PORT ?? 27121);
if (!Number.isInteger(dbPort) || dbPort < 1024 || dbPort > 65535) throw new Error('Invalid local database port');
const container = dbPort === 27121 ? 'smarterp-quickstart-mongo' : `smarterp-quickstart-mongo-${dbPort}`;
const children = [];
let stopping = false;
let ownsLock = false;
let db;
await mkdir(local, { recursive: true, mode: 0o700 });
const lockPath = join(local, 'launcher.pid');

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, ...options });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; });
    child.stderr?.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} failed. ${output.slice(-2000)}`)));
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function cleanup() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  }
  await wait(750);
  for (const child of children) {
    if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
  if (db) await db.$disconnect();
  if (ownsLock) await unlink(lockPath).catch(() => {});
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  void cleanup().finally(() => process.exit(0));
});
async function availablePort(preferred) {
  for (let port = preferred; port < preferred + 20; port++) {
    const server = createServer();
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      await new Promise(resolve => server.close(resolve));
      return port;
    } catch { server.close(); }
  }
  throw new Error(`No free local port near ${preferred}`);
}
function start(name, command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  const log = join(local, `${name}.log`);
  // Preserve diagnostics without flooding the user's terminal.
  let writes = Promise.resolve();
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    writes = writes.then(async () => {
      const { appendFile } = await import('node:fs/promises');
      await appendFile(log, chunk, { mode: 0o600 });
    }).catch(() => {});
  });
  child.on('error', error => { console.error(`${name}: ${error.message}`); void cleanup().finally(() => process.exit(1)); });
  child.on('exit', code => {
    if (!stopping) { console.error(`${name} stopped. See ${log}`); void cleanup().finally(() => process.exit(code || 1)); }
  });
}
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    if (stopping) throw new Error('Startup stopped');
    await wait(250);
  }
  throw new Error(`Service did not become ready: ${url}. Check .local/*.log`);
}

try {
  try {
    const previous = Number(await readFile(lockPath, 'utf8'));
    if (Number.isInteger(previous) && previous > 0) {
      let running = true;
      try { process.kill(previous, 0); } catch (error) { if (error.code === 'ESRCH') running = false; else throw error; }
      if (running) throw new Error('SmartERP is already running. Use its existing terminal or stop it with Ctrl+C.');
    }
    await unlink(lockPath);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const lock = await open(lockPath, 'wx', 0o600);
  await lock.writeFile(String(process.pid)); await lock.close(); ownsLock = true;
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required.');
  await run('pnpm', ['--version']);
  await run('docker', ['info', '--format', '{{.ServerVersion}}']);

  console.log('1/4 Preparing the app (the first start can take a few minutes)…');
  const env = { ...process.env, DATABASE_URL: `mongodb://127.0.0.1:${dbPort}/smarterp_local?directConnection=true&replicaSet=rs0`, NODE_ENV: 'development', ENABLE_LEGACY_DEMO: 'false', ENABLE_CRON: 'false', ENABLE_REFERENCE_SOURCE: 'true' };
  for (const folder of ['backend', 'frontend']) {
    const fingerprint = createHash('sha256').update(await readFile(join(root, folder, 'package.json'))).update(await readFile(join(root, folder, 'pnpm-lock.yaml'))).digest('hex');
    let installed = false;
    try { installed = (await readFile(join(local, `${folder}.dependencies`), 'utf8')) === fingerprint; await readFile(join(root, folder, 'node_modules/.modules.yaml')); } catch { installed = false; }
    if (!installed) {
      await run('pnpm', ['install', '--frozen-lockfile'], { cwd: join(root, folder), env });
      await writeFile(join(local, `${folder}.dependencies`), fingerprint);
    }
  }
  console.log('2/4 Starting the local database…');
  let existing;
  try { existing = JSON.parse(await run('docker', ['inspect', container]))[0]; } catch {}
  if (existing) {
    if (existing.Config.Labels?.['smarterp.quickstart'] !== 'v1' || existing.Config.Image !== 'mongo:7.0') throw new Error(`Container ${container} belongs to another setup; it was not changed.`);
    const binding = existing.HostConfig.PortBindings?.['27017/tcp']?.[0];
    if (binding?.HostIp !== '127.0.0.1' || binding.HostPort !== String(dbPort)) throw new Error('Quickstart database has an unexpected port mapping.');
    await run('docker', ['start', container]);
  } else {
    await run('docker', ['run', '-d', '--name', container, '--label', 'smarterp.quickstart=v1', '-p', `127.0.0.1:${dbPort}:27017`, 'mongo:7.0', '--replSet', 'rs0', '--bind_ip_all']);
  }
  let primary = false;
  for (let i = 0; i < 40; i++) {
    try {
      await run('docker', ['exec', container, 'mongosh', '--quiet', '--eval', 'try { rs.status(); } catch(e) { if (e.code === 94) rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]}); else throw e; } if (!db.hello().isWritablePrimary) quit(1);']);
      primary = true; break;
    } catch { await wait(500); }
  }
  if (!primary) throw new Error('The local MongoDB replica set did not become ready.');
  const backend = join(root, 'backend');
  await run('pnpm', ['exec', 'prisma', 'generate'], { cwd: backend, env });
  await run('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], { cwd: backend, env });

  let token;
  const tokenPath = join(local, 'workspace-token');
  try { token = (await readFile(tokenPath, 'utf8')).trim(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!token) { token = randomBytes(32).toString('hex'); await writeFile(tokenPath, token, { mode: 0o600, flag: 'wx' }); }
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('The saved local workspace token is invalid.');
  // Prisma's environment is read from the explicit development config, not .env.
  const require = createRequire(join(backend, 'package.json'));
  const { PrismaClient } = require('@prisma/client');
  db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const apiKeyHash = createHash('sha256').update(token).digest('hex');
  const business = await db.integrationBusiness.upsert({ where: { apiKeyHash }, create: { name: 'My local workspace', timezone: 'Asia/Kolkata', apiKeyHash }, update: {} });
  await db.sourceConnection.upsert({ where: { businessId_adapter: { businessId: business.id, adapter: 'reference-v1' } }, create: { businessId: business.id }, update: {} });
  await db.$disconnect(); db = undefined;
  // Preserve the original ERP database when a user already configured it.
  // Schema creation above is restricted to the separate quickstart database.
  const { parse } = require('dotenv');
  let previousConfig = {};
  try { previousConfig = parse(await readFile(join(backend, '.env'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const originalDatabase = process.env.SMARTERP_APP_DATABASE_URL || previousConfig.DATABASE_URL || env.DATABASE_URL;
  console.log(originalDatabase === env.DATABASE_URL ? 'Using the local app database.' : 'Using your existing database for the original app.');

  const ml = join(root, 'ml-service');
  let python;
  for (const candidate of [join(ml, '.venv/bin/python'), join(ml, 'venv/bin/python')]) {
    try { await run(candidate, ['-c', 'import fastapi, uvicorn, pandas, numpy, sklearn']); python = candidate; break; } catch {}
  }
  if (!python) {
    console.log('Preparing Python forecasting dependencies…');
    await run('python3', ['-m', 'venv', join(ml, '.venv')]);
    python = join(ml, '.venv/bin/python');
    await run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], { cwd: ml });
  }

  console.log('3/4 Starting your app and forecasting service…');
  const [apiPort, sourcePort, uiPort, mlPort] = await Promise.all([availablePort(5000), availablePort(5100), availablePort(5173), availablePort(8000)]);
  const runtime = { ...env, DATABASE_URL: originalDatabase, INTEGRATION_DATABASE_URL: env.DATABASE_URL, ENABLE_LEGACY_DEMO: 'true', ML_SERVICE_URL: `http://127.0.0.1:${mlPort}`, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', PORT: String(apiPort), REFERENCE_PORT: String(sourcePort), REFERENCE_SOURCE_URL: `http://127.0.0.1:${sourcePort}`, REFERENCE_POLL_MS: '3000', REFERENCE_STATE_FILE: join(local, 'source-state.json'), VITE_API_URL: `http://127.0.0.1:${apiPort}/api`, VITE_ENABLE_LEGACY_DEMO: 'false' };
  const tsx = join(backend, 'node_modules/.bin/tsx');
  start('ml', python, ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(mlPort)], ml, runtime);
  start('source', tsx, [join(root, 'reference-source/server.ts')], backend, runtime);
  start('backend', tsx, ['src/index.ts'], backend, runtime);
  start('frontend', join(root, 'frontend/node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'], join(root, 'frontend'), runtime);
  await Promise.all([ready(`http://127.0.0.1:${sourcePort}/records`), ready(`http://127.0.0.1:${apiPort}/health`), ready(`http://127.0.0.1:${uiPort}`), ready(`http://127.0.0.1:${mlPort}/health`)]);
  start('worker', tsx, ['src/workers/reference.worker.ts'], backend, runtime);
  console.log(`4/4 Ready. Open http://127.0.0.1:${uiPort}`);
  console.log('Your original landing page and dashboard are available. Connections is an additional sidebar tab.');
  console.log(`Connections tab token (only needed there): ${token}`);
  console.log('Keep this terminal open. Press Ctrl+C to stop. Your local data is saved.');
} catch (error) {
  console.error(`Startup failed: ${error.message}`);
  await cleanup(); process.exitCode = 1;
}
