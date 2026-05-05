import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getKauvioServerActivationConfig,
  activateKauvioServerFeatures,
} from './kauvio_server_activation.mjs';

test('getKauvioServerActivationConfig defaults AI search on', () => {
  const config = getKauvioServerActivationConfig({});

  assert.equal(config.enabled, true);
  assert.equal(config.registerSearchAlias, true);
});

test('getKauvioServerActivationConfig reads environment flags', () => {
  const config = getKauvioServerActivationConfig({
    KAUVIO_AI_SEARCH_ENABLED: 'false',
    KAUVIO_AI_SEARCH_ALIAS_ENABLED: '0',
  });

  assert.equal(config.enabled, false);
  assert.equal(config.registerSearchAlias, false);
});

test('activateKauvioServerFeatures returns disabled state when disabled', async () => {
  const app = {
    get() { throw new Error('should not register'); },
    post() { throw new Error('should not register'); },
  };

  const result = await activateKauvioServerFeatures(app, {
    enabled: false,
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(result.config.enabled, false);
  assert.equal(result.aiSearch.enabled, false);
});

test('activateKauvioServerFeatures registers routes with provided pool', async () => {
  const calls = [];
  const app = {
    get(path) { calls.push(['GET', path]); },
    post(path) { calls.push(['POST', path]); },
  };
  const pool = { async query() { return { rows: [] }; } };

  const result = await activateKauvioServerFeatures(app, {
    pool,
    logger: { info() {}, warn() {}, error() {} },
    registerSearchAlias: true,
  });

  assert.equal(result.aiSearch.enabled, true);
  assert.equal(calls.length, 4);
});
