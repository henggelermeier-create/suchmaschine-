import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enqueueSearchResults,
  runKauvioIngestionWorkerOnce,
  saveAndMatchKauvioIngestedProduct,
} from './kauvio_ingestion_queue.mjs';

function createCanonicalMockPool() {
  const state = {
    jobs: [],
    products: [],
    canonicals: [],
    offers: [],
    nextJobId: 1,
    nextProductId: 1,
    nextCanonicalId: 1,
    nextOfferId: 1,
  };

  return {
    state,
    async query(sql, params) {
      if (/INSERT INTO kauvio_ingestion_jobs/i.test(sql)) {
        const job = { id: state.nextJobId++, job_type: params[0], payload: JSON.parse(params[1]), priority: params[2], max_attempts: params[3], attempts: 0, status: 'pending' };
        state.jobs.push(job);
        return { rows: [job] };
      }

      if (/UPDATE kauvio_ingestion_jobs job/i.test(sql)) {
        const job = state.jobs.find((item) => item.status === 'pending');
        if (!job) return { rows: [] };
        job.status = 'processing';
        job.attempts += 1;
        return { rows: [job] };
      }

      if (/INSERT INTO kauvio_ingested_products/i.test(sql)) {
        const product = { id: state.nextProductId++, title: params[0], brand: params[1], category: params[2], price: params[3], currency: params[4], merchant: params[5], url: params[6], payload: JSON.parse(params[12]) };
        state.products.push(product);
        return { rows: [product] };
      }

      if (/FROM kauvio_canonical_products/i.test(sql)) {
        return { rows: state.canonicals };
      }

      if (/INSERT INTO kauvio_canonical_products/i.test(sql)) {
        const existing = state.canonicals.find((item) => item.canonical_key === params[0]);
        if (existing) return { rows: [existing] };
        const canonical = { id: state.nextCanonicalId++, canonical_key: params[0], title: params[1], brand: params[2], category: params[3], fingerprint: params[4], payload: JSON.parse(params[5]) };
        state.canonicals.push(canonical);
        return { rows: [canonical] };
      }

      if (/INSERT INTO kauvio_canonical_product_offers/i.test(sql)) {
        const offer = { id: state.nextOfferId++, canonical_product_id: params[0], ingested_product_id: params[1], product_url: params[2], merchant: params[3], price: params[4], currency: params[5], match_score: params[6], match_reasons: JSON.parse(params[7]), payload: JSON.parse(params[8]) };
        state.offers.push(offer);
        return { rows: [offer] };
      }

      if (/SET status = 'completed'/i.test(sql)) {
        const job = state.jobs.find((item) => item.id === params[0]);
        job.status = 'completed';
        return { rows: [job] };
      }

      if (/SET status = \$2/i.test(sql)) {
        const job = state.jobs.find((item) => item.id === params[0]);
        job.status = params[1];
        return { rows: [job] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

test('saveAndMatchKauvioIngestedProduct stores product and creates canonical', async () => {
  const pool = createCanonicalMockPool();
  const result = await saveAndMatchKauvioIngestedProduct(pool, {
    title: 'Lenovo ThinkPad T14 16GB 512GB',
    brand: 'Lenovo',
    category: 'Laptop',
    price: 999,
    url: 'https://shop.ch/t14',
  });

  assert.equal(result.stored.title, 'Lenovo ThinkPad T14 16GB 512GB');
  assert.equal(pool.state.canonicals.length, 1);
  assert.equal(pool.state.offers.length, 1);
});

test('runKauvioIngestionWorkerOnce matches search result products to canonicals', async () => {
  const pool = createCanonicalMockPool();
  await enqueueSearchResults(pool, [
    { title: 'Lenovo ThinkPad T14 16GB 512GB', brand: 'Lenovo', url: 'https://shop-a.ch/t14', price: 999 },
    { title: 'Lenovo ThinkPad T14 Notebook 512GB 16GB', brand: 'Lenovo', url: 'https://shop-b.ch/t14', price: 979 },
  ]);

  const result = await runKauvioIngestionWorkerOnce(pool, {
    logger: { info() {}, error() {} },
    canonicalThreshold: 60,
  });

  assert.equal(result.processed, true);
  assert.equal(pool.state.jobs[0].status, 'completed');
  assert.equal(pool.state.products.length, 2);
  assert.ok(pool.state.canonicals.length >= 1);
  assert.equal(pool.state.offers.length, 2);
});
