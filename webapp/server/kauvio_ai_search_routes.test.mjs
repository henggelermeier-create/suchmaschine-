import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createKauvioAiSearchHandler,
  defaultProductMapper,
} from './kauvio_ai_search_routes.mjs';

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('defaultProductMapper normalizes common product fields', () => {
  const product = defaultProductMapper({
    product_id: '123',
    product_title: 'Test Laptop',
    current_price: 599,
    shop_name: 'Swiss Shop',
    product_url: 'https://example.ch/p/123',
  });

  assert.equal(product.id, '123');
  assert.equal(product.title, 'Test Laptop');
  assert.equal(product.price, 599);
  assert.equal(product.merchant, 'Swiss Shop');
  assert.equal(product.url, 'https://example.ch/p/123');
});

test('createKauvioAiSearchHandler returns ranked products and advisor output', async () => {
  const handler = createKauvioAiSearchHandler({
    productProvider: async () => [
      {
        id: '1',
        title: 'Lenovo IdeaPad Laptop für Schule 16GB RAM',
        price: 649,
        merchant: 'Swiss Shop CH',
        availability: 'lieferbar',
        rating: 4.5,
        reviews_count: 100,
        avg_90d_price: 750,
        return_policy: true,
      },
    ],
    logger: { error() {} },
  });

  const req = {
    method: 'GET',
    query: { q: 'guter Laptop für Schule unter 700 CHF', limit: '10' },
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.intent.category, 'laptop');
  assert.equal(res.payload.products.length, 1);
  assert.ok(res.payload.products[0].kauvio_score > 0);
  assert.ok(res.payload.advisor.summary.includes('Beste Wahl'));
  assert.equal(res.payload.meta.engine, 'kauvio_ai_product_search_v1');
});

test('createKauvioAiSearchHandler rejects empty queries', async () => {
  const handler = createKauvioAiSearchHandler({ logger: { error() {} } });
  const req = { method: 'GET', query: {} };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.ok, false);
});
