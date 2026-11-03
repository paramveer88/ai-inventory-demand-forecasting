import 'dotenv/config';
import prisma from '../integrations/client.js';
import { IntegrationService } from '../integrations/service.js';
import { referenceDestination } from '../integrations/contracts.js';

const rawUrl = process.env.REFERENCE_SOURCE_URL ?? 'http://127.0.0.1:5100';
referenceDestination(rawUrl); // fail closed before connecting to any source
const service = new IntegrationService(prisma);
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
const interval = Number(process.env.REFERENCE_POLL_MS ?? 30000);
if (!Number.isFinite(interval) || interval < 1000) throw new Error('REFERENCE_POLL_MS must be at least 1000');
console.log('Reference-only worker started. Synthetic source; historical coverage is not established.');
try {
  while (!stopping) {
    const connections = await prisma.sourceConnection.findMany({ where: { adapter: 'reference-v1' } });
    for (const c of connections) {
      if (stopping) break;
      try { await service.collect(c.businessId, c.id, rawUrl); }
      catch { console.error(`Collection unavailable for connection ${c.id}; processing durable records continues`); }
      let count = 0;
      while (!stopping && count++ < 1000 && await service.processOne(c.businessId, c.id)) { /* bounded work batch */ }
    }
    // Short waits let shutdown remain responsive.
    for (let waited = 0; !stopping && waited < interval; waited += 250) await new Promise(resolve => setTimeout(resolve, 250));
  }
} finally { await prisma.$disconnect(); }
