import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { SourceRecord, SourcePage, hashRecord, referenceDestination, businessDate } from './contracts.js';

export class IntegrationService {
  constructor(private readonly db: PrismaClient) {}

  async collect(businessId: string, connectionId: string, rawUrl: string) {
    const connection = await this.db.sourceConnection.findFirst({ where: { id: connectionId, businessId } });
    if (!connection) throw new Error('Connection not found');
    const origin = referenceDestination(rawUrl);
    await this.db.sourceConnection.update({ where: { id: connectionId }, data: { collectionComplete: false, lastError: null } });
    let cursor: string | null = null;
    let snapshot: string | undefined;
    const seen = new Set<string>();
    try {
      for (let pageNumber = 0; pageNumber < 1000; pageNumber++) {
        const url = new URL('/records', origin);
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
        // Reference-only endpoint with bounded payload; never accept arbitrary provider URLs.
        const body = await response.text();
        if (Buffer.byteLength(body) > 1_000_000) throw new Error('Source page exceeds limit');
        const page = SourcePage.parse(JSON.parse(body));
        if (snapshot && snapshot !== page.snapshot) throw new Error('Source changed during pagination; retry full collection');
        snapshot = page.snapshot;
        for (const record of page.records) await this.receive(businessId, connectionId, record);
        cursor = page.nextCursor;
        if (cursor === null) {
          await this.db.sourceConnection.update({ where: { id: connectionId }, data: { collectionComplete: true, lastCollectedAt: new Date(), lastError: null } });
          return;
        }
        if (seen.has(cursor)) throw new Error('Source repeated a pagination cursor');
        seen.add(cursor);
      }
      throw new Error('Source pagination exceeds limit');
    } catch (error) {
      // Preserve a safe diagnostic, not arbitrary source payloads/secrets.
      const message = error instanceof Error && error.message.startsWith('Source ') ? error.message : 'Collection failed; check source availability and contract';
      await this.db.sourceConnection.update({ where: { id: connectionId }, data: { lastError: message, collectionComplete: false } });
      throw new Error(message);
    }
  }

  async receive(businessId: string, connectionId: string, input: unknown) {
    const record = SourceRecord.parse(input);
    const connection = await this.db.sourceConnection.findFirst({ where: { id: connectionId, businessId } });
    if (!connection) throw new Error('Connection not found');
    const identity = { connectionId, resource: record.resource, externalId: record.externalId, revision: record.revision };
    const payloadHash = hashRecord(record);
    const inbox = await this.db.sourceInbox.upsert({
      where: { connectionId_resource_externalId_revision: identity },
      create: { ...identity, businessId, payloadHash, payload: record, occurredAt: new Date(record.occurredAt), sourceUpdatedAt: new Date(record.sourceUpdatedAt) },
      update: {},
    });
    if (inbox.payloadHash !== payloadHash) {
      // Keep the first received payload for investigation; don't choose arrival order.
      await this.db.sourceInbox.update({ where: { id: inbox.id }, data: { status: 'quarantined', error: 'REVISION_CONFLICT', leaseToken: null, leaseUntil: null } });
    }
    return inbox.id;
  }

  async processOne(businessId: string, connectionId: string): Promise<boolean> {
    const now = new Date();
    await this.db.sourceInbox.updateMany({
      where: { businessId, connectionId, status: 'processing', attempts: { gte: 5 }, leaseUntil: { lt: now } },
      data: { status: 'failed', error: 'ATTEMPTS_EXHAUSTED', leaseToken: null, leaseUntil: null },
    });
    const candidate = await this.db.sourceInbox.findFirst({
      where: { businessId, connectionId, attempts: { lt: 5 }, OR: [ { status: 'pending' }, { status: 'processing', leaseUntil: { lt: now } } ] },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    });
    if (!candidate) return false;
    const token = randomUUID();
    const claimed = await this.db.sourceInbox.updateMany({
      where: { id: candidate.id, attempts: { lt: 5 }, OR: [{ status: 'pending' }, { status: 'processing', leaseUntil: { lt: now } }] },
      data: { status: 'processing', leaseToken: token, leaseUntil: new Date(now.getTime() + 30000), attempts: { increment: 1 } },
    });
    if (!claimed.count) return true;
    try {
      await this.db.$transaction(async tx => {
        // This write fences concurrent workers and makes the canonical effect atomic
        // with status. An expired owner cannot commit after the lease was reclaimed.
        const owned = await tx.sourceInbox.updateMany({
          where: { id: candidate.id, status: 'processing', leaseToken: token, leaseUntil: { gt: new Date() } },
          data: { appliedAt: new Date() },
        });
        if (!owned.count) return;
        const r = SourceRecord.parse(candidate.payload);
        const key = { connectionId, externalId: r.externalId };
        let status = 'applied';
        if (r.resource === 'product') {
          const old = await tx.sourceProduct.findUnique({ where: { connectionId_externalId: key } });
          if (!old || r.revision > old.revision) {
            await tx.sourceProduct.upsert({ where: { connectionId_externalId: key },
              create: { ...key, businessId, name: r.name, sku: r.sku ?? null, revision: r.revision, sourceUpdatedAt: new Date(r.sourceUpdatedAt) },
              update: { name: r.name, sku: r.sku ?? null, revision: r.revision, sourceUpdatedAt: new Date(r.sourceUpdatedAt) } });
            await tx.sourceInbox.updateMany({ where: { connectionId, status: 'quarantined', error: 'UNMAPPED_PRODUCT' }, data: { status: 'pending', error: null, attempts: 0 } });
          } else status = 'ignored';
        } else {
          const product = await tx.sourceProduct.findUnique({ where: { connectionId_externalId: { connectionId, externalId: r.externalProductId } } });
          if (!product) {
            await tx.sourceInbox.update({ where: { id: candidate.id }, data: { status: 'quarantined', error: 'UNMAPPED_PRODUCT', appliedAt: null, leaseToken: null, leaseUntil: null } });
            return;
          }
          const common = { ...key, businessId, productId: product.id, externalProductId: r.externalProductId, quantity: r.quantity, occurredAt: new Date(r.occurredAt), sourceUpdatedAt: new Date(r.sourceUpdatedAt), appliedAt: new Date(), revision: r.revision };
          if (r.resource === 'fulfillment') {
            const old = await tx.sourceFulfillment.findUnique({ where: { connectionId_externalId: key } });
            if (!old || r.revision > old.revision) await tx.sourceFulfillment.upsert({ where: { connectionId_externalId: key }, create: common, update: common });
            else status = 'ignored';
          } else {
            // v1 has one location and one stable balance identity per source product.
            if (r.externalId !== `${r.externalProductId}@default`) throw new Error('INVALID_BALANCE_ID');
            const old = await tx.sourceStock.findUnique({ where: { connectionId_externalId: key } });
            if (!old || r.revision > old.revision) await tx.sourceStock.upsert({ where: { connectionId_externalId: key }, create: { ...common, quantityType: r.quantityType }, update: { ...common, quantityType: r.quantityType } });
            else status = 'ignored';
          }
        }
        await tx.sourceInbox.update({ where: { id: candidate.id }, data: { status, error: null, leaseToken: null, leaseUntil: null } });
      });
    } catch (error) {
      const transient = error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code);
      await this.db.sourceInbox.updateMany({ where: { id: candidate.id, status: 'processing', leaseToken: token }, data: {
        status: transient && candidate.attempts < 4 ? 'pending' : 'failed',
        error: transient ? 'RETRYABLE_CONFLICT' : 'PROCESSING_FAILED', leaseToken: null, leaseUntil: null,
      } });
    }
    return true;
  }

  async view(businessId: string) {
    const business = await this.db.integrationBusiness.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, timezone: true } });
    const connections = await this.db.sourceConnection.findMany({ where: { businessId } });
    const products = await this.db.sourceProduct.findMany({ where: { businessId } });
    const fulfillments = await this.db.sourceFulfillment.findMany({ where: { businessId } });
    const stock = await this.db.sourceStock.findMany({ where: { businessId } });
    const inbox = await this.db.sourceInbox.findMany({ where: { businessId }, select: { id: true, connectionId: true, resource: true, externalId: true, status: true, error: true, receivedAt: true, appliedAt: true, attempts: true }, orderBy: { receivedAt: 'desc' }, take: 100 });
    // Count all unresolved records, including those outside the recent display page.
    const unresolved = await this.db.sourceInbox.count({ where: { businessId, status: { in: ['pending', 'processing', 'quarantined', 'failed'] } } });
    return {
      business, connections, inbox, unresolved, synthetic: true, contract: 'reference-v1',
      ingestionState: connections.length && connections.every(c => c.collectionComplete) && !unresolved ? 'applied' : 'incomplete',
      forecastReadiness: { state: 'blocked', reasons: ['HISTORICAL_COVERAGE_NOT_ESTABLISHED', 'FORECAST_PIPELINE_NOT_CONNECTED'] },
      products: products.map(p => {
        const daily = new Map<string, number>();
        const observations = fulfillments.filter(f => f.productId === p.id);
        for (const f of observations) {
          const date = businessDate(f.occurredAt, business.timezone);
          daily.set(date, (daily.get(date) ?? 0) + f.quantity);
        }
        return { ...p, stock: stock.find(s => s.productId === p.id) ?? null,
          fulfilledUnits: observations.reduce((sum, f) => sum + f.quantity, 0),
          dailySales: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, quantity]) => ({ date, quantity, coverage: 'unknown' })),
        };
      }),
    };
  }
}
