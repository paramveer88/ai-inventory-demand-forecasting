import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const browserRequire=createRequire(`${root}/frontend/package.json`);
const {chromium}=browserRequire('@playwright/test');
const require=createRequire(`${root}/backend/package.json`);
const {PrismaClient}=require('@prisma/client');
const database=process.env.DATABASE_URL;
if(!database)throw new Error('DATABASE_URL must identify an isolated smarterp_test replica set');
const target=new URL(database);
if(target.protocol!=='mongodb:'||target.hostname!=='127.0.0.1'||target.pathname!=='/smarterp_test')throw new Error('Refusing a non-test database');
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const [apiPort,sourcePort,uiPort]=await Promise.all([freePort(),freePort(),freePort()]);
const db=new PrismaClient({datasources:{db:{url:database}}});
const token=randomBytes(32).toString('hex');
const business=await db.integrationBusiness.create({data:{name:'Browser verification',timezone:'Europe/Berlin',apiKeyHash:createHash('sha256').update(token).digest('hex')}});
const catalogProduct=await db.product.create({data:{name:'Existing catalog product',category:'Browser test',inventory:{create:{currentStock:27}}}});
const children=[];
const directory=await mkdtemp(join(tmpdir(),'smarterp-browser-'));
const state=join(directory,'source-state.json');
await writeFile(state,await readFile(`${root}/reference-source/data/seed.json`));
const env={...process.env,DATABASE_URL:database,INTEGRATION_DATABASE_URL:database,PORT:String(apiPort),NODE_ENV:'development',ENABLE_REFERENCE_SOURCE:'true',ENABLE_LEGACY_DEMO:'true',REFERENCE_PORT:String(sourcePort),REFERENCE_STATE_FILE:state,REFERENCE_SOURCE_URL:`http://127.0.0.1:${sourcePort}`,REFERENCE_POLL_MS:'1000',VITE_API_URL:`http://127.0.0.1:${apiPort}/api`,VITE_ENABLE_LEGACY_DEMO:'true'};
function start(file,args,cwd){const c=spawn(file,args,{cwd,env,detached:true,stdio:'ignore'});children.push(c);return c;}
let browser;
try {
  const tsx=`${root}/backend/node_modules/.bin/tsx`;
  start(tsx,[`${root}/reference-source/server.ts`],`${root}/backend`);
  start(tsx,['src/index.ts'],`${root}/backend`);
  start(tsx,['src/workers/reference.worker.ts'],`${root}/backend`);
  start(`${root}/frontend/node_modules/.bin/vite`,['--host','127.0.0.1','--port',String(uiPort),'--strictPort'],`${root}/frontend`);
  for(let i=0;i<60;i++){try {if((await fetch(`http://127.0.0.1:${apiPort}/health`)).ok && (await fetch(`http://127.0.0.1:${uiPort}`)).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${uiPort}`);
  // Existing launch experience and all original tabs must remain available.
  await page.getByRole('button',{name:'Launch Dashboard',exact:true}).click();
  for(const label of ['Dashboard','Products','Vendors','Inventory','Orders','Forecasting Lab','Connections']) {
    assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),1);
  }
  const catalog=await fetch(`http://127.0.0.1:${apiPort}/api/products`);
  assert.equal(catalog.status,200);
  assert((await catalog.json()).products.some(p=>p.id===catalogProduct.id));
  await page.getByRole('button',{name:'Products',exact:true}).click();
  await page.getByText('Existing catalog product',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Connections',exact:true}).click();
  await page.getByLabel('Workspace access token').fill(token);
  await page.getByRole('button',{name:'Open workspace'}).click();
  await page.getByRole('button',{name:'Connect reference source'}).click();
  await page.getByText('Reported available stock: 20',{exact:true}).waitFor({timeout:30000});
  await page.getByText('Recorded fulfilled units: 3',{exact:true}).waitFor();
  const data=JSON.parse(await readFile(state,'utf8'));
  data.records[1].quantity=6;data.records[1].revision=2;
  await writeFile(state,JSON.stringify(data));
  await page.getByText('Recorded fulfilled units: 6',{exact:true}).waitFor({timeout:20000});
  assert.equal(await page.getByText('Reported available stock: 20',{exact:true}).count(),1);
  assert.equal(await db.sourceFulfillment.count({where:{businessId:business.id}}),1);
  if(process.env.BROWSER_SCREENSHOT)await page.screenshot({path:process.env.BROWSER_SCREENSHOT,fullPage:true});
  await page.getByRole('button',{name:'Close workspace / change token'}).click();
  assert.equal(await page.getByText('Reference notebook',{exact:true}).count(),0);
  assert.equal(await page.getByLabel('Workspace access token').inputValue(),'');
  assert.deepEqual(errors,[]);
  console.log('PASS: original landing/dashboard/navigation preserved; reference HTTP source → polling worker → authenticated API → browser UI; corrected fulfillment replaces quantity; source stock stays 20; sign-out clears data; no browser errors.');
}finally{
  if(browser)await browser.close();
  for(const c of children){try{process.kill(-c.pid,'SIGTERM');}catch{}}
  await new Promise(r=>setTimeout(r,500));
  for(const c of children){if(c.exitCode===null){try{process.kill(-c.pid,'SIGKILL');}catch{}}}
  for(const model of ['sourceInbox','sourceFulfillment','sourceStock','sourceProduct','sourceConnection'])await db[model].deleteMany({where:{businessId:business.id}});
  await db.integrationBusiness.delete({where:{id:business.id}});
  await db.forecast.deleteMany({where:{productId:catalogProduct.id}});
  await db.forecastRun.deleteMany({where:{productId:catalogProduct.id}});
  await db.inventory.delete({where:{productId:catalogProduct.id}});
  await db.product.delete({where:{id:catalogProduct.id}});
  await db.$disconnect();await rm(directory,{recursive:true,force:true});
}
