import assert from 'node:assert/strict';
import test from 'node:test';

import { createKauvioFeedbackAwareSearchHandler } from './kauvio_feedback_aware_search_routes.mjs';

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

test('feedback-aware search applies feedback and reorders products', async () => {
  const productProvider = async () => [
    {
      id: 'bad',
      title: 'Laptop Schule Bad Shop',
      price: 640,
      merchant: 'Risky Shop',
      availability: 'lieferbar',
      rating: 4.8,
      reviews_count: 100,
      return_policy: true,
    },
    {
      id: 'good',
      title: 'Laptop Schule guter Deal',
      price: 650,
      merchant: 'Swiss Shop CH',
      availability: 'lieferbar',
      rating: 4.2,
      reviews_count: 40,
      return_policy: true,
    },
  ];

  const pool = {
    async query(sql, params) {
      assert.match(sql, /kauvio_search_feedback_scoring/);
      assert.ok(params[0].includes('bad'));
      assert.ok(params[0].includes('good'));
      return {
        rows: [
          {
            feedback_target: 'bad',
            total_feedback: 10,
            bad_shop_count: 10,
            negative_feedback: 10,
            positive_feedback: 0,
          },
          {
            feedback_target: 'good',
            total_feedback: 10,
            fits_count: 10,
            positive_feedback: 10,
            negative_feedback: 0,
          },
        ],
      };
    },
  };

  const handler = createKauvioFeedbackAwareSearchHandler({
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
  assert.equal(res.payload.meta.feedback_optimized, true);
  assert.equal(res.payload.meta.engine, 'kauvio_ai_product_search_feedback_v1');
  assert.equal(res.payload.products[0].id, 'good');
  assert.equal(res.payload.advisor.feedback_optimized, true);
});

test('feedback-aware search preserves base errors', async () => {
  const handler = createKauvioFeedbackAwareSearchHandler({ logger: { error() {}, warn() {} } });
  const req = { method: 'GET', query: {}, headers: {} };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.ok, false);
});
