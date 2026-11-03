import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Separate persisted source. Edit the state file, increasing the affected record's
// revision, to simulate a source-side update. The worker uses HTTP only.
const path = process.env.REFERENCE_STATE_FILE ?? fileURLToPath(new URL('./data/state.json', import.meta.url));
await mkdir(fileURLToPath(new URL('./data/', import.meta.url)), { recursive: true });
try { await readFile(path); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  await writeFile(path, await readFile(new URL('./data/seed.json', import.meta.url)), { flag: 'wx' });
}
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== '/records') { res.writeHead(404).end('{}'); return; }
    const raw = await readFile(path, 'utf8');
    const state = JSON.parse(raw) as { records: unknown[] };
    const snapshot = createHash('sha256').update(raw).digest('hex');
    const cursor = url.searchParams.get('cursor');
    const match = cursor?.match(/^([a-f0-9]{64}):(\d+)$/);
    if (cursor && (!match || match[1] !== snapshot)) { res.writeHead(409).end('{"error":"snapshot changed"}'); return; }
    const offset = match ? Number(match[2]) : 0;
    const records = state.records.slice(offset, offset + 2);
    const nextCursor = offset + 2 < state.records.length ? `${snapshot}:${offset + 2}` : null;
    res.end(JSON.stringify({ contract: 'reference-v1', synthetic: true, historicalCoverage: null, snapshot, records, nextCursor }));
  } catch { res.writeHead(503).end('{"error":"source unavailable"}'); }
});
server.listen(Number(process.env.REFERENCE_PORT ?? 5100), '127.0.0.1', () => console.log('Synthetic reference source listening on loopback'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
