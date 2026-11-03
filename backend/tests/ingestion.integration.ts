import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { IntegrationService } from '../src/integrations/service.js';
import type { SourceRecord } from '../src/integrations/contracts.js';
import app from '../src/app.js';
import sharedPrisma from '../src/lib/prisma.js';
import integrationPrisma from '../src/integrations/client.js';

const target = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (target.protocol !== 'mongodb:' || target.hostname !== '127.0.0.1' || target.pathname !== '/smarterp_test') throw new Error('Use an isolated loopback smarterp_test database');
process.env.ENABLE_REFERENCE_SOURCE = 'true';
process.env.NODE_ENV = 'test';
process.env.ENABLE_LEGACY_DEMO = 'false';
const db = new PrismaClient();
const service = new IntegrationService(db);
const at = '2026-11-02T12:00:00Z';
const product: SourceRecord = { resource: 'product', externalId: 'v1', name: 'Notebook', revision: 1, occurredAt: at, sourceUpdatedAt: at };
const sale: SourceRecord = { resource: 'fulfillment', externalId: 'f1', externalProductId: 'v1', quantity: 3, revision: 1, occurredAt: at, sourceUpdatedAt: at };
const stock: SourceRecord = { resource: 'inventory', externalId: 'v1@default', externalProductId: 'v1', quantity: 20, quantityType: 'available', location: 'default', revision: 1, occurredAt: at, sourceUpdatedAt: at };

async function drain(b: string, c: string) { for (let n=0; n<30 && await service.processOne(b,c); n++); }

test('durable ingestion, recovery, source stock and authenticated isolation', async () => {
  const key = randomBytes(32).toString('hex');
  const otherKey = randomBytes(32).toString('hex');
  const b = await db.integrationBusiness.create({ data: { name: 'Test', timezone: 'Europe/Berlin', apiKeyHash: createHash('sha256').update(key).digest('hex') } });
  const other = await db.integrationBusiness.create({ data: { name: 'Other', timezone: 'UTC', apiKeyHash: createHash('sha256').update(otherKey).digest('hex') } });
  const c = await db.sourceConnection.create({ data: { businessId: b.id } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await service.receive(b.id,c.id,sale);
    await drain(b.id,c.id);
    assert.equal((await service.view(b.id)).unresolved,1);
    await service.receive(b.id,c.id,product);
    await drain(b.id,c.id);
    await service.receive(b.id,c.id,stock);
    await drain(b.id,c.id);
    // An exact replay cannot create an additional effect.
    await service.receive(b.id,c.id,sale); await drain(b.id,c.id);
    assert.equal(await db.sourceFulfillment.count({ where: { businessId: b.id } }),1);
    assert.equal((await service.view(b.id)).products[0]?.stock?.quantity,20);
    assert.equal((await service.view(b.id)).products[0]?.fulfilledUnits,3);
    // Revision update replaces quantity, not adds it. Older arrival cannot regress it.
    await service.receive(b.id,c.id,{...sale, revision:3, quantity:5}); await drain(b.id,c.id);
    await service.receive(b.id,c.id,{...sale, revision:2, quantity:4}); await drain(b.id,c.id);
    assert.equal((await service.view(b.id)).products[0]?.fulfilledUnits,5);
    assert.equal((await service.view(b.id)).products[0]?.stock?.quantity,20);
    // Persisted work can be reclaimed after a worker dies.
    const id=await service.receive(b.id,c.id,{...stock, revision:2, quantity:18});
    await db.sourceInbox.update({where:{id},data:{status:'processing',leaseToken:'expired-worker',leaseUntil:new Date(0)}});
    await drain(b.id,c.id);
    assert.equal((await service.view(b.id)).products[0]?.stock?.quantity,18);
    // Concurrent claims cannot apply the same fulfillment twice.
    await service.receive(b.id,c.id,{...sale,externalId:'f-concurrent',quantity:2});
    await Promise.all([service.processOne(b.id,c.id),service.processOne(b.id,c.id)]);
    await drain(b.id,c.id);
    assert.equal(await db.sourceFulfillment.count({where:{businessId:b.id,externalId:'f-concurrent'}}),1);
    // Exhausted crashed work becomes a visible failure, not a permanent processing lease.
    const exhausted=await service.receive(b.id,c.id,{...sale,externalId:'f-exhausted',quantity:1});
    await db.sourceInbox.update({where:{id:exhausted},data:{status:'processing',attempts:5,leaseToken:'dead',leaseUntil:new Date(0)}});
    await drain(b.id,c.id);
    assert.equal((await db.sourceInbox.findUniqueOrThrow({where:{id:exhausted}})).status,'failed');
    await db.sourceInbox.update({where:{id:exhausted},data:{status:'pending',attempts:0}});
    await drain(b.id,c.id);
    // Equal identity+revision but different payload is unresolved, never silently chosen.
    await service.receive(b.id,c.id,{...stock,revision:2,quantity:99});
    assert.equal((await service.view(b.id)).unresolved,1);
    assert.equal((await service.view(b.id)).products[0]?.stock?.quantity,18);
    const headers={Authorization:`Bearer ${key}`};
    assert.equal((await fetch(`${base}/api/integrations/status`)).status,401);
    assert.equal((await fetch(`${base}/api/integrations/status`,{headers:{Authorization:'Bearer wrong'}})).status,401);
    const own=await fetch(`${base}/api/integrations/status`,{headers}); assert.equal(own.status,200);
    const hidden=await fetch(`${base}/api/integrations/status`,{headers:{Authorization:`Bearer ${otherKey}`}});
    assert.equal((await hidden.json() as { products:unknown[] }).products.length,0);
    assert.equal((await fetch(`${base}/api/integrations/connections/${c.id}/retry`,{method:'POST',headers:{Authorization:`Bearer ${otherKey}`}})).status,404);
    assert.equal((await fetch(`${base}/api/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(`${base}/api/simulate-data`,{method:'POST'})).status,403);
    assert.equal((await fetch(`${base}/api/forecast/seed-history`)).status,403);
    assert.equal((await service.view(b.id)).forecastReadiness.state,'blocked');
    await assert.rejects(service.receive(other.id,c.id,product),/Connection not found/);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()));
    for (const businessId of [b.id,other.id]) {
      await db.sourceInbox.deleteMany({where:{businessId}}); await db.sourceFulfillment.deleteMany({where:{businessId}});
      await db.sourceStock.deleteMany({where:{businessId}}); await db.sourceProduct.deleteMany({where:{businessId}});
      await db.sourceConnection.deleteMany({where:{businessId}}); await db.integrationBusiness.delete({where:{id:businessId}});
    }
    await db.$disconnect(); await sharedPrisma.$disconnect(); await integrationPrisma.$disconnect();
  }
});

test('HTTP pagination persists pages; partial failures never mark collection complete', async () => {
  const b = await db.integrationBusiness.create({data:{name:'Paging',timezone:'UTC',apiKeyHash:randomBytes(32).toString('hex')}});
  const c = await db.sourceConnection.create({data:{businessId:b.id}});
  let fail=true;
  const source=createServer((req,res)=>{
    const second=req.url?.includes('cursor=next');
    if (second && fail) {res.writeHead(503).end();return;}
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({contract:'reference-v1',synthetic:true,historicalCoverage:null,snapshot:'stable',records:second?[sale,stock]:[product],nextCursor:second?null:'next'}));
  }).listen(0,'127.0.0.1'); await once(source,'listening');
  const url=`http://127.0.0.1:${(source.address() as AddressInfo).port}`;
  try {
    await assert.rejects(service.collect(b.id,c.id,url));
    assert.equal(await db.sourceInbox.count({where:{businessId:b.id}}),1);
    assert.equal((await service.view(b.id)).connections[0]?.collectionComplete,false);
    fail=false;
    await service.collect(b.id,c.id,url);await drain(b.id,c.id);
    assert.equal((await service.view(b.id)).ingestionState,'applied');
    assert.equal((await service.view(b.id)).forecastReadiness.state,'blocked');
    assert.equal((await service.view(b.id)).products[0]?.stock?.quantity,20);
    await service.collect(b.id,c.id,url);await drain(b.id,c.id);
    assert.equal(await db.sourceInbox.count({where:{businessId:b.id}}),3);
  } finally {
    source.closeAllConnections();await new Promise<void>(resolve=>source.close(()=>resolve()));
    await db.sourceInbox.deleteMany({where:{businessId:b.id}});await db.sourceStock.deleteMany({where:{businessId:b.id}});
    await db.sourceFulfillment.deleteMany({where:{businessId:b.id}});await db.sourceProduct.deleteMany({where:{businessId:b.id}});
    await db.sourceConnection.deleteMany({where:{businessId:b.id}});await db.integrationBusiness.delete({where:{id:b.id}});
    await db.$disconnect();
  }
});
