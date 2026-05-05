import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyKauvioFeedbackToProduct,
  applyKauvioFeedbackToProducts,
  calculateKauvioFeedbackSignal,
  loadKauvioFeedbackSummary,
} from './kauvio_feedback_scoring.mjs';

test('calculateKauvioFeedbackSignal rewards positive feedback', () => {
  const signal = calculateKauvioFeedbackSignal({
    total_feedback: 6,
    fits_count: 4,
    great_deal_count: 2,
    positive_feedback: 6,
    negative_feedback: 0,
  });

  assert.ok(signal.score_delta > 0);
  assert.equal(signal.negative_feedback, 0);
});

test('calculateKauvioFeedbackSignal penalizes negative feedback', () => {
  const signal = calculateKauvioFeedbackSignal({
    total_feedback: 5,
    not_relevant_count: 2,
    wrong_category_count: 2,
    bad_shop_count: 1,
    positive_feedback: 0,
    negative_feedback: 5,
  });

  assert.ok(signal.score_delta < 0);
  assert.equal(signal.positive_feedback, 0);
});

test('applyKauvioFeedbackToProduct adjusts Kauvio score and reasons', () => {
  const product = applyKauvioFeedbackToProduct({
    id: 'p1',
    title: 'Laptop',
    kauvio_score: 80,
    ranking_reasons: ['passt zur Suchabsicht'],
  }, {
    total_feedback: 8,
    fits_count: 8,
    positive_feedback: 8,
    negative_feedback: 0,
  });

  assert.ok(product.kauvio_score > 80);
  assert.ok(product.ranking_reasons.includes('Nutzerfeedback bestätigt dieses Ergebnis'));
});

test('applyKauvioFeedbackToProducts sorts after feedback adjustment', () => {
  const products = [
    { id: 'bad', title: 'Bad Product', kauvio_score: 90 },
    { id: 'good', title: 'Good Product', kauvio_score: 82 },
  ];
  const feedback = new Map([
    ['bad', { total_feedback: 10, bad_shop_count: 10, negative_feedback: 10, positive_feedback: 0 }],
    ['good', { total_feedback: 10, fits_count: 10, positive_feedback: 10, negative_feedback: 0 }],
  ]);

  const ranked = applyKauvioFeedbackToProducts(products, feedback);
  assert.equal(ranked[0].id, 'good');
});

test('loadKauvioFeedbackSummary queries scoring view for all product identifiers', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{ feedback_target: 'p1', total_feedback: 1, fits_count: 1 }],
      };
    },
  };

  const map = await loadKauvioFeedbackSummary(pool, [{ id: 'p1', url: 'https://example.ch/p1', title: 'Laptop' }]);

  assert.equal(map.get('p1').fits_count, 1);
  assert.match(calls[0].sql, /kauvio_search_feedback_scoring/);
  assert.deepEqual(calls[0].params[0], ['p1', 'https://example.ch/p1', 'Laptop']);
});
