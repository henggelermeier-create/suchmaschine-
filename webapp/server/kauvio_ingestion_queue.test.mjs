import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enqueueShopUrl,
  enqueueSearchResults,
  saveKauvioIngestedProduct,
  runKauvioIngestionWorkerOnce,
} from './kauvio_ingestion_queue.mjs';

function createMockPool() {
  const state = {
    jobs: [],
    products: [],
    nextJobId: 1,
    nextProductId: 1,
  };

  return {
    state,
    async query(sql, params) {
      if (/INSERT INTO kauvio_ingestion_jobs/i.test(sql)) {
        const job = {
          id: state.nextJobId++,
          job_type: params[0],
          payload: JSON.parse(params[1]),
          priority: params[2],
          max_attempts: params[3],
          attempts: 0,
          status: 'pending',
        };
        state.jobs.push(job);
        return { rows: [job] };
      }

      if (/UPDATE kauvio_ingestion_jobs job/i.test(sql)) {
        const job = state.jobs.find((item) => item.status === 'pending' && item.attempts < item.max_attempts);
        if (!job) return { rows: [] };
        job.status = 'processing';
        job.attempts += 1;
        job.locked_by = params[0];
        return { rows: [job] };
      }

      if (/INSERT INTO kauvio_ingested_products/i.test(sql)) {
        const product = {
          id: state.nextProductId++,
          title: params[0],
          brand: params[1],
          category: params[2],
          price: params[3],
          currency: params[4],
          merchant: params[5],
          url: params[6],
          image: params[7],
          description: params[8],
          availability: params[9],
          domain: params[10],
          raw_source: params[11],
          payload: JSON.parse(params[12]),
        };
        state.products.push(product);
        return { rows: [product] };
      }

      if (/SET status = 'completed'/i.test(sql)) {
        const job = state.jobs.find((item) => item.id === params[0]);
        job.status = 'completed';
        return { rows: [job] };
      }

      if (/SET status = \$2/i.test(sql)) {
        const job = state.jobs.find((item) => item.id === params[0]);
        job.status = params[1];
        job.last_error = params[2];
        return { rows: [job] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

test('enqueueShopUrl creates a shop_url ingestion job', async () => {
  const pool = createMockPool();
  const job = await enqueueShopUrl(pool, 'https://shop.ch/product', { priority: 10 });

  assert.equal(job.job_type, 'shop_url');
  assert.equal(job.payload.url, 'https://shop.ch/product');
  assert.equal(job.priority, 10);
});

test('enqueueSearchResults creates a search_results ingestion job', async () => {
  const pool = createMockPool();
  const job = await enqueueSearchResults(pool, [{ title: 'Produkt', url: 'https://shop.ch/p' }]);

  assert.equal(job.job_type, 'search_results');
  assert.equal(job.payload.results.length, 1);
});

test('saveKauvioIngestedProduct stores normalized product', async () => {
  const pool = createMockPool();
  const product = await saveKauvioIngestedProduct(pool, {
    title: 'Produkt',
    price: 199,
    url: 'https://shop.ch/p',
  });

  assert.equal(product.title, 'Produkt');
  assert.equal(product.domain, 'shop.ch');
});

test('runKauvioIngestionWorkerOnce processes search result jobs', async () => {
  const pool = createMockPool();
  await enqueueSearchResults(pool, [
    { title: 'Produkt 1', url: 'https://shop.ch/1', price: 100 },
    { title: 'Produkt 2', url: 'https://shop.ch/2', price: 200 },
  ]);

  const result = await runKauvioIngestionWorkerOnce(pool, {
    logger: { info() {}, error() {} },
  });

  assert.equal(result.processed, true);
  assert.equal(pool.state.jobs[0].status, 'completed');
  assert.equal(pool.state.products.length, 2);
});

test('runKauvioIngestionWorkerOnce processes shop URL jobs', async () => {
  const pool = createMockPool();
  await enqueueShopUrl(pool, 'https://shop.ch/product');

  const fetcher = async () => ({
    ok: true,
    status: 200,
    async text() {
      return '<html><head><title>Shop Produkt</title><meta property="product:price:amount" content="149"></head></html>';
    },
  });

  const result = await runKauvioIngestionWorkerOnce(pool, {
    fetcher,
    logger: { info() {}, error() {} },
  });

  assert.equal(result.processed, true);
  assert.equal(pool.state.products[0].title, 'Shop Produkt');
});
