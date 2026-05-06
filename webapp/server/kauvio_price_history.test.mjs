import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateKauvioBuyTiming,
  enrichProductWithKauvioPriceHistory,
  recordKauvioCanonicalOfferPrices,
  recordKauvioCanonicalPriceSnapshot,
} from './kauvio_price_history.mjs';

function createMockPool() {
  const state = { snapshots: [], nextId: 1, summary: null };
  return {
    state,
    async query(sql, params) {
      if (/INSERT INTO kauvio_canonical_price_history/i.test(sql)) {
        const row = {
          id: state.nextId++,
          canonical_product_id: params[0],
          offer_id: params[1],
          merchant: params[2],
          product_url: params[3],
          price: params[4],
          currency: params[5],
          captured_at: params[6],
          payload: JSON.parse(params[7]),
        };
        state.snapshots.push(row);
        return { rows: [row] };
      }

      if (/FROM kauvio_canonical_price_summary/i.test(sql)) {
        return { rows: state.summary ? [state.summary] : [] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

test('recordKauvioCanonicalPriceSnapshot stores a snapshot', async () => {
  const pool = createMockPool();
  const row = await recordKauvioCanonicalPriceSnapshot(pool, {
    canonical_product_id: 1,
    offer_id: 10,
    merchant: 'Swiss Shop',
    product_url: 'https://shop.ch/p1',
    price: 199,
    currency: 'CHF',
  });

  assert.equal(row.canonical_product_id, 1);
  assert.equal(row.price, 199);
  assert.equal(pool.state.snapshots.length, 1);
});

test('recordKauvioCanonicalOfferPrices stores prices for offers', async () => {
  const pool = createMockPool();
  const rows = await recordKauvioCanonicalOfferPrices(pool, {
    canonical_product_id: 1,
    currency: 'CHF',
    offers: [
      { offer_id: 1, merchant: 'A', price: 100, url: 'https://a.ch/p' },
      { offer_id: 2, merchant: 'B', price: 120, url: 'https://b.ch/p' },
      { offer_id: 3, merchant: 'C', price: null, url: 'https://c.ch/p' },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(pool.state.snapshots.length, 2);
});

test('calculateKauvioBuyTiming recommends buy_now for low prices', () => {
  const timing = calculateKauvioBuyTiming({
    sample_count: 12,
    latest_price: 180,
    avg_90d_price: 230,
    lowest_90d_price: 175,
    highest_price: 280,
  });

  assert.equal(timing.decision, 'buy_now');
  assert.ok(timing.confidence > 0.6);
});

test('calculateKauvioBuyTiming recommends wait for high prices', () => {
  const timing = calculateKauvioBuyTiming({
    sample_count: 12,
    latest_price: 270,
    avg_90d_price: 220,
    lowest_90d_price: 170,
    highest_price: 280,
  });

  assert.equal(timing.decision, 'wait');
  assert.ok(timing.confidence > 0.6);
});

test('calculateKauvioBuyTiming returns unknown with too few samples', () => {
  const timing = calculateKauvioBuyTiming({ sample_count: 1, latest_price: 200 });
  assert.equal(timing.decision, 'unknown');
});

test('enrichProductWithKauvioPriceHistory attaches summary and timing', async () => {
  const pool = createMockPool();
  pool.state.summary = {
    canonical_product_id: 1,
    sample_count: 10,
    latest_price: 190,
    avg_90d_price: 240,
    lowest_90d_price: 185,
    highest_price: 280,
  };

  const product = await enrichProductWithKauvioPriceHistory(pool, {
    canonical_product_id: 1,
    price: 190,
  });

  assert.equal(product.price_history_summary.canonical_product_id, 1);
  assert.equal(product.buy_timing.decision, 'buy_now');
});
