import { createHash } from 'node:crypto';
import { z } from 'zod';

const id = z.string().min(1).max(200);
const base = {
  externalId: id,
  revision: z.number().int().min(1).max(2147483647),
  occurredAt: z.string().datetime({ offset: true }),
  sourceUpdatedAt: z.string().datetime({ offset: true }),
};
export const SourceRecord = z.discriminatedUnion('resource', [
  z.object({ ...base, resource: z.literal('product'), name: z.string().min(1).max(200), sku: z.string().max(200).optional() }).strict(),
  z.object({ ...base, resource: z.literal('fulfillment'), externalProductId: id, quantity: z.number().int().min(0).max(2147483647) }).strict(),
  z.object({ ...base, resource: z.literal('inventory'), externalProductId: id, quantity: z.number().int().min(0).max(2147483647), quantityType: z.literal('available'), location: z.literal('default') }).strict(),
]);
export type SourceRecord = z.infer<typeof SourceRecord>;
export const SourcePage = z.object({
  contract: z.literal('reference-v1'), synthetic: z.literal(true),
  records: z.array(SourceRecord).max(100), nextCursor: z.string().nullable(),
  snapshot: z.string().min(1),
  // Collection completeness is not historical sales/availability coverage.
  historicalCoverage: z.null(),
}).strict();
export function hashRecord(record: SourceRecord): string {
  const normalized = SourceRecord.parse(record);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
export function businessDate(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
export function referenceDestination(raw: string): URL {
  const url = new URL(raw);
  // No configurable arbitrary outbound HTTP in this slice. No DNS names/redirects.
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REFERENCE_SOURCE !== 'true' ||
      url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Reference source requires development mode, explicit opt-in and an IPv4 loopback HTTP origin');
  }
  return url;
}
