import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildKauvioProductFingerprint,
  findBestCanonicalMatch,
  groupProductsIntoCanonicals,
  scoreKauvioProductMatch,
} from './kauvio_canonical_matching.mjs';

test('buildKauvioProductFingerprint extracts brand, category and model tokens', () => {
  const fingerprint = buildKauvioProductFingerprint({
    title: 'Lenovo ThinkPad T14 16GB 512GB Laptop',
    brand: 'Lenovo',
    category: 'Laptop',
  });

  assert.equal(fingerprint.brand, 'lenovo');
  assert.equal(fingerprint.category, 'laptop');
  assert.ok(fingerprint.model_tokens.includes('t14'));
  assert.ok(fingerprint.fingerprint.includes('lenovo'));
});

test('scoreKauvioProductMatch scores equivalent products highly', () => {
  const match = scoreKauvioProductMatch({
    title: 'Lenovo ThinkPad T14 16GB 512GB Laptop',
    brand: 'Lenovo',
    category: 'Laptop',
  }, {
    title: 'Lenovo ThinkPad T14 Notebook 512GB 16GB',
    brand: 'Lenovo',
    category: 'Laptop',
  });

  assert.ok(match.score >= 72);
  assert.ok(match.brand_match);
  assert.ok(match.reasons.length > 0);
});

test('findBestCanonicalMatch returns best candidate above threshold', () => {
  const result = findBestCanonicalMatch({
    title: 'Apple iPhone 15 128GB Schwarz',
    brand: 'Apple',
    category: 'Smartphone',
  }, [
    { id: '1', title: 'Samsung Galaxy S24 256GB', brand: 'Samsung', category: 'Smartphone' },
    { id: '2', title: 'Apple iPhone 15 128GB Black', brand: 'Apple', category: 'Smartphone' },
  ], { threshold: 65 });

  assert.equal(result.matched, true);
  assert.equal(result.canonical.id, '2');
});

test('groupProductsIntoCanonicals groups equivalent products', () => {
  const groups = groupProductsIntoCanonicals([
    { id: 'a', title: 'Dyson V15 Detect Staubsauger', brand: 'Dyson', category: 'Vacuum', merchant: 'Shop A' },
    { id: 'b', title: 'Dyson V15 Detect Vacuum Cleaner', brand: 'Dyson', category: 'Vacuum', merchant: 'Shop B' },
    { id: 'c', title: 'Apple iPhone 15 128GB', brand: 'Apple', category: 'Phone' },
  ], { threshold: 60 });

  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.brand === 'Dyson').offers.length, 2);
});
