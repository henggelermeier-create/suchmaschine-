import assert from 'node:assert/strict';
import test from 'node:test';

import { createKauvioProductProvider } from './kauvio_product_provider.mjs';

const intent = {
  query_terms: ['laptop', 'schule'],
  category: 'laptop',
  use_cases: ['school'],
  filters: {
    max_price: 700,
    currency: 'CHF',
  },
};

test('createKauvioProductProvider queries Kauvio canonical products first', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      assert.match(sql, /kauvio_canonical_products/);
      assert.match(sql, /kauvio_canonical_product_offers/);
      return {
        rows: [{
          id: 1,
          canonical_product_id: 1,
          canonical_key: 'lenovo|laptop|t14',
          title: 'Lenovo ThinkPad T14',
          brand: 'Lenovo',
          category: 'Laptop',
          price: 649,
          currency: 'CHF',
          merchant: 'Swiss Shop',
          offer_count: 2,
          offers: [
            { merchant: 'Swiss Shop', price: 649, currency: 'CHF', url: 'https://shop.ch/t14' },
            { merchant: 'Other Shop', price: 679, currency: 'CHF', url: 'https://other.ch/t14' },
          ],
          best_offer: { merchant: 'Swiss Shop', price: 649, currency: 'CHF', url: 'https://shop.ch/t14' },
        }],
      };
    },
  };

  const provider = createKauvioProductProvider({ pool, logger: { error() {} } });
  const rows = await provider.searchProducts({ query: 'Laptop Schule unter 700 CHF', intent, limit: 10 });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].canonical_product_id, 1);
  assert.equal(rows[0].offer_count, 2);
  assert.equal(rows[0].best_offer.price, 649);
  assert.equal(calls.length, 1);
});

test('createKauvioProductProvider falls back when Kauvio canonical tables are missing', async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (calls.length === 1) {
        const error = new Error('relation "kauvio_canonical_products" does not exist');
        error.code = '42P01';
        throw error;
      }
      return { rows: [{ id: 'fallback', title: 'Fallback Product' }] };
    },
  };

  const provider = createKauvioProductProvider({ pool, logger: { error() {} } });
  const rows = await provider.searchProducts({ query: 'Laptop', intent, limit: 5 });

  assert.equal(rows[0].id, 'fallback');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /product_search_index/);
});
