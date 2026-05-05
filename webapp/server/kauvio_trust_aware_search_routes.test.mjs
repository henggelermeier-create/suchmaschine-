import assert from 'node:assert/strict';
import test from 'node:test';

import { createKauvioTrustAwareSearchHandler } from './kauvio_trust_aware_search_routes.mjs';

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('trust-aware search penalizes risky shops and promotes trusted shops', async () => {
  const productProvider = async () => [
    {
      id: 'risky',
      title: 'Laptop Schule Super Sale',
      price: 99,
      avg_90d_price: 800,
      merchant: 'Laptop Sale',
      url: 'http://laptop-sale.xyz/p/1',
      availability: 'lieferbar',
      rating: 4.9,
      reviews_count: 500,
    },
    {
      id: 'trusted',
      title: 'Laptop Schule Swiss Shop',
      price: 650,
      merchant: 'Swiss Shop AG',
      url: 'https://swiss-shop.ch/p/2',
      availability: 'lieferbar',
      return_policy: true,
      warranty: true,
      rating: 4.2,
      reviews_count: 40,
    },
  ];

  const pool = {
    async query() {
      return { rows: [] };
    },
  };

  const handler = createKauvioTrustAwareSearchHandler({
    pool,
    productProvider,
    logger: { error() {}, warn() {} },
  });

  const req = {
    method: 'GET',
    query: { q: 'guter Laptop für Schule unter 700 CHF', limit: '10' },
    headers: {},
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.meta.shop_trust_optimized, true);
  assert.equal(res.payload.meta.engine, 'kauvio_ai_product_search_trust_v1');
  assert.equal(res.payload.products[0].id, 'trusted');
  assert.equal(res.payload.products.find((product) => product.id === 'risky').shop_risk_level, 'risky');
  assert.equal(res.payload.advisor.shop_trust_optimized, true);
  assert.ok(res.payload.advisor.warnings.length >= 1);
});

test('trust-aware search preserves validation errors from base search', async () => {
  const handler = createKauvioTrustAwareSearchHandler({ logger: { error() {}, warn() {} } });
  const req = { method: 'GET', query: {}, headers: {} };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.ok, false);
});
