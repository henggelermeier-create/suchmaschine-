import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInMemoryKauvioProductProvider,
  createKauvioProductProvider,
} from './kauvio_product_provider.mjs';

const intent = {
  query_terms: ['laptop', 'schule'],
  category: 'laptop',
  use_cases: ['school'],
  filters: {
    max_price: 700,
    currency: 'CHF',
  },
};

test('createInMemoryKauvioProductProvider filters by terms and soft budget', async () => {
  const provider = createInMemoryKauvioProductProvider([
    { id: '1', title: 'Lenovo Laptop Schule', price: 649 },
    { id: '2', title: 'Gaming Desktop', price: 1200 },
    { id: '3', title: 'Laptop Tasche', price: 40 },
  ]);

  const rows = await provider.searchProducts({
    query: 'guter Laptop für Schule unter 700 CHF',
    intent,
    limit: 10,
  });

  assert.deepEqual(rows.map((row) => row.id), ['1', '3']);
});

test('createKauvioProductProvider uses first compatible query', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{ id: 'p1', title: 'Laptop', price: 599 }],
      };
    },
  };

  const provider = createKauvioProductProvider({ pool, logger: { error() {} } });
  const rows = await provider.searchProducts({ query: 'Laptop unter 700 CHF', intent, limit: 5 });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'p1');
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /product_search_index/);
  assert.equal(calls[0].params.at(-1), 5);
});

test('createKauvioProductProvider falls back when preferred table is missing', async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (calls.length === 1) {
        const error = new Error('relation "product_search_index" does not exist');
        error.code = '42P01';
        throw error;
      }
      return { rows: [{ id: 'canonical-1', title: 'Canonical Laptop' }] };
    },
  };

  const provider = createKauvioProductProvider({ pool, logger: { error() {} } });
  const rows = await provider.searchProducts({ query: 'Laptop', intent, limit: 5 });

  assert.equal(rows[0].id, 'canonical-1');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /canonical_products/);
});

test('createKauvioProductProvider requires a queryable pool', () => {
  assert.throws(() => createKauvioProductProvider(), /requires a PostgreSQL-compatible pool/);
});
