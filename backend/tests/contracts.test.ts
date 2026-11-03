import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceRecord, hashRecord, referenceDestination, businessDate } from '../src/integrations/contracts.js';

const product = { resource: 'product', externalId: 'v1', revision: 1, occurredAt: '2026-11-01T10:00:00Z', sourceUpdatedAt: '2026-11-01T10:00:00Z', name: 'Notebook' };
test('source identities, quantities and explicit stock semantics are validated', () => {
  assert.equal(SourceRecord.parse(product).resource, 'product');
  assert.throws(() => SourceRecord.parse({ ...product, revision: 0 }));
  assert.throws(() => SourceRecord.parse({ ...product, customerEmail: 'unnecessary@example.com' }));
  const stock = { ...product, resource: 'inventory', externalProductId: 'v1', quantity: -1, quantityType: 'on_hand', location: 'default' };
  delete (stock as Partial<typeof stock>).name;
  assert.throws(() => SourceRecord.parse(stock));
});
test('canonical hashing ignores source object property ordering', () => {
  const a = SourceRecord.parse(product);
  const b = SourceRecord.parse(Object.fromEntries(Object.entries(product).reverse()));
  assert.equal(hashRecord(a), hashRecord(b));
});
test('reference destination rejects arbitrary origins and production use', () => {
  const old = { node: process.env.NODE_ENV, enabled: process.env.ENABLE_REFERENCE_SOURCE };
  try {
    process.env.NODE_ENV = 'test'; process.env.ENABLE_REFERENCE_SOURCE = 'true';
    assert.equal(referenceDestination('http://127.0.0.1:5100').hostname, '127.0.0.1');
    for (const url of ['http://169.254.169.254', 'http://localhost:5100', 'http://example.com', 'http://user:password@127.0.0.1:5100', 'http://127.0.0.1:5100/?next=http://example.com']) assert.throws(() => referenceDestination(url));
    process.env.NODE_ENV = 'production'; assert.throws(() => referenceDestination('http://127.0.0.1:5100'));
  } finally {
    if (old.node === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old.node;
    if (old.enabled === undefined) delete process.env.ENABLE_REFERENCE_SOURCE; else process.env.ENABLE_REFERENCE_SOURCE = old.enabled;
  }
});
test('business dates respect timezone and DST', () => {
  assert.equal(businessDate(new Date('2026-10-25T22:30:00Z'), 'Europe/Berlin'), '2026-10-25');
  assert.equal(businessDate(new Date('2026-10-25T23:30:00Z'), 'Europe/Berlin'), '2026-10-26');
  assert.equal(businessDate(new Date('2026-11-01T20:00:00Z'), 'Asia/Kolkata'), '2026-11-02');
});
