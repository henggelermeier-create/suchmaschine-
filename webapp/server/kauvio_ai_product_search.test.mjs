import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractKauvioSearchIntent,
  rankProductsForKauvio,
  scoreProductForKauvio,
} from './kauvio_ai_product_search.mjs';

test('extractKauvioSearchIntent detects Swiss product-buying intent', () => {
  const intent = extractKauvioSearchIntent('guter Laptop für Schule unter 700 CHF');

  assert.equal(intent.category, 'laptop');
  assert.equal(intent.budget.max, 700);
  assert.equal(intent.currency, 'CHF');
  assert.ok(intent.use_cases.includes('school'));
  assert.ok(intent.priorities.includes('battery'));
  assert.ok(intent.priorities.includes('value'));
});

test('scoreProductForKauvio rewards budget fit, trust, availability and deal signals', () => {
  const intent = extractKauvioSearchIntent('guter Laptop für Schule unter 700 CHF');
  const product = scoreProductForKauvio({
    id: 'p1',
    title: 'Lenovo IdeaPad Laptop 16GB RAM für Schule',
    price: 649,
    merchant: 'Swiss Shop CH',
    availability: 'lieferbar',
    rating: 4.5,
    reviews_count: 120,
    avg_90d_price: 760,
    return_policy: true,
  }, intent);

  assert.ok(product.kauvio_score >= 75);
  assert.ok(product.ranking_reasons.length > 0);
  assert.match(product.decision_badge, /Top|Deal|Alternative|Option/);
});

test('rankProductsForKauvio returns advisor recommendations ordered by Kauvio score', () => {
  const result = rankProductsForKauvio('bequeme Schuhe für langes Stehen unter 150 CHF', [
    {
      id: 'bad',
      title: 'Elegante Schuhe',
      price: 240,
      availability: 'nicht lieferbar',
      merchant: 'Unknown Store',
    },
    {
      id: 'good',
      title: 'Bequeme Arbeitsschuhe mit Dämpfung und Komfort',
      price: 119,
      availability: 'lieferbar',
      merchant: 'Swiss Comfort Shop CH',
      rating: 4.6,
      reviews_count: 80,
      avg_90d_price: 149,
      return_policy: true,
    },
  ]);

  assert.equal(result.intent.category, 'shoes');
  assert.equal(result.products[0].id, 'good');
  assert.equal(result.advisor.top_recommendation.id, 'good');
  assert.ok(result.advisor.summary.includes('Beste Wahl'));
});
