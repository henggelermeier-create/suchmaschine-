import assert from 'node:assert/strict';
import test from 'node:test';

import { createKauvioPriceAwareSearchHandler } from './kauvio_price_aware_search_routes.mjs';

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

test('price-aware search enriches canonical products with buy timing', async () => {
  const productProvider = async () => [{
    id: 1,
    canonical_product_id: 1,
    title: 'Lenovo ThinkPad T14',
    brand: 'Lenovo',
    category: 'Laptop',
    price: 649,
    currency: 'CHF',
    merchant: 'Swiss Shop',
    url: 'https://shop.ch/t14',
    offer_count: 2,
    offers: [
      { offer_id: 1, merchant: 'Swiss Shop', price: 649, currency: 'CHF', url: 'https://shop.ch/t14' },
    ],
  }];

  const pool = {
    async query(sql, params) {
      if (/kauvio_search_feedback_scoring/i.test(sql)) return { rows: [] };
      if (/kauvio_canonical_price_summary/i.test(sql)) {
        assert.equal(params[0], 1);
        return {
          rows: [{
            canonical_product_id: 1,
            sample_count: 12,
            latest_price: 649,
            avg_90d_price: 760,
            lowest_90d_price: 640,
            highest_price: 890,
          }],
        };
      }
      return { rows: [] };
    },
  };

  const handler = createKauvioPriceAwareSearchHandler({
    pool,
    productProvider,
    logger: { error() {}, warn() {} },
  });

  const req = {
    method: 'GET',
    query: { q: 'Lenovo Laptop Schule', limit: '10' },
    headers: {},
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.meta.price_history_optimized, true);
  assert.equal(res.payload.meta.engine, 'kauvio_ai_product_search_price_v1');
  assert.equal(res.payload.products[0].buy_timing.decision, 'buy_now');
  assert.equal(res.payload.advisor.price_history_optimized, true);
});

test('price-aware search preserves base validation errors', async () => {
  const handler = createKauvioPriceAwareSearchHandler({ logger: { error() {}, warn() {} } });
  const req = { method: 'GET', query: {}, headers: {} };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.ok, false);
});
