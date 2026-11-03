import { createHash } from 'node:crypto';
import { Router } from 'express';
import prisma from './client.js';
import { IntegrationService } from './service.js';

export const integrations: Router = Router();
const service = new IntegrationService(prisma);
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }

integrations.use(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ') || auth.length > 200) { res.status(401).json({ error: 'BUSINESS_TOKEN_REQUIRED' }); return; }
  const business = await prisma.integrationBusiness.findUnique({ where: { apiKeyHash: tokenHash(auth.slice(7)) }, select: { id: true } });
  if (!business) { res.status(401).json({ error: 'INVALID_BUSINESS_TOKEN' }); return; }
  res.locals.businessId = business.id;
  next();
});
integrations.get('/status', async (_req, res) => { res.json(await service.view(res.locals.businessId as string)); });
integrations.post('/connections', async (req, res) => {
  if (process.env.ENABLE_REFERENCE_SOURCE !== 'true' || process.env.NODE_ENV === 'production') { res.status(409).json({ error: 'REFERENCE_SOURCE_DISABLED' }); return; }
  if (Object.keys(req.body ?? {}).length) { res.status(400).json({ error: 'REFERENCE_CONNECTION_TAKES_NO_EXTERNAL_URL_OR_CREDENTIALS' }); return; }
  const businessId = res.locals.businessId as string;
  const connection = await prisma.sourceConnection.upsert({ where: { businessId_adapter: { businessId, adapter: 'reference-v1' } }, create: { businessId }, update: {} });
  res.status(201).json(connection);
});
integrations.post('/connections/:id/retry', async (req, res) => {
  const id = String(req.params.id);
  if (!/^[a-f0-9]{24}$/.test(id)) { res.status(404).json({ error: 'CONNECTION_NOT_FOUND' }); return; }
  const businessId = res.locals.businessId as string;
  if (!await prisma.sourceConnection.findFirst({ where: { id, businessId } })) { res.status(404).json({ error: 'CONNECTION_NOT_FOUND' }); return; }
  // Conflicting revisions require source correction; don't blindly replay them.
  const result = await prisma.sourceInbox.updateMany({ where: { businessId, connectionId: id, OR: [{ status: 'failed' }, { status: 'quarantined', error: 'UNMAPPED_PRODUCT' }] }, data: { status: 'pending', error: null, attempts: 0, leaseToken: null, leaseUntil: null } });
  res.status(202).json({ requeued: result.count });
});
