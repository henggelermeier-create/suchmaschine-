import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createKauvioLiveAiSearchDependencies,
  registerKauvioLiveAiSearch,
} from './kauvio_live_ai_search.mjs';

test('createKauvioLiveAiSearchDependencies uses provided pool', async () => {
  const pool = { async query() { return { rows: [] }; } };
  const result = await createKauvioLiveAiSearchDependencies({
    pool,
    logger: { warn() {}, error() {} },
  });

  assert.equal(result.pool, pool);
  assert.equal(result.ownsPool, false);
  assert.ok(result.productProvider);
});

test('createKauvioLiveAiSearchDependencies disables when database URL is missing', async () => {
  const warnings = [];
  const result = await createKauvioLiveAiSearchDependencies({
    env: {},
    logger: { warn(message, meta) { warnings.push({ message, meta }); } },
  });

  assert.equal(result.pool, null);
  assert.equal(result.productProvider, null);
  assert.equal(result.disabledReason, 'missing_database_url');
  assert.equal(warnings.length, 1);
});

test('registerKauvioLiveAiSearch can be disabled by option', async () => {
  const app = { get() { throw new Error('should not register'); }, post() { throw new Error('should not register'); } };
  const result = await registerKauvioLiveAiSearch(app, {
    enabled: false,
    logger: { info() {} },
  });

  assert.equal(result.enabled, false);
  assert.equal(result.reason, 'disabled_by_option');
});

test('registerKauvioLiveAiSearch registers routes with provided pool', async () => {
  const calls = [];
  const app = {
    get(path) { calls.push(['GET', path]); },
    post(path) { calls.push(['POST', path]); },
  };
  const pool = { async query() { return { rows: [] }; } };

  const result = await registerKauvioLiveAiSearch(app, {
    pool,
    registerSearchAlias: true,
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(result.enabled, true);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => call[1]), [
    '/api/kauvio/ai-search',
    '/api/kauvio/ai-search',
    '/api/search/ai',
    '/api/search/ai',
  ]);
});
