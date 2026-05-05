import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyKauvioShopTrust,
  applyKauvioShopTrustToProducts,
  calculateKauvioShopTrust,
} from './kauvio_shop_trust.mjs';

test('calculateKauvioShopTrust rewards trusted Swiss shop signals', () => {
  const trust = calculateKauvioShopTrust({
    merchant: 'Swiss Electronics AG',
    url: 'https://example.ch/product/1',
    return_policy: true,
    warranty: true,
    rating: 4.6,
    reviews_count: 120,
  });

  assert.equal(trust.shop_risk_level, 'trusted');
  assert.ok(trust.shop_trust_score >= 75);
  assert.ok(trust.shop_trust_reasons.includes('Schweizer .ch-Domain erkannt'));
});

test('calculateKauvioShopTrust flags suspicious domain and too-good-to-be-true price', () => {
  const trust = calculateKauvioShopTrust({
    merchant: 'Brand Outlet',
    url: 'http://brand-outlet.xyz/p/1',
    price: 99,
    avg_90d_price: 500,
  });

  assert.equal(trust.shop_risk_level, 'risky');
  assert.ok(trust.shop_warnings.includes('Domain wirkt potenziell verdächtig'));
  assert.ok(trust.shop_warnings.includes('Preis wirkt ungewöhnlich niedrig im Vergleich zum Referenzpreis'));
});

test('applyKauvioShopTrust adjusts score and reasons', () => {
  const product = applyKauvioShopTrust({
    id: 'p1',
    title: 'Laptop',
    kauvio_score: 80,
    merchant: 'Risk Shop',
    url: 'http://risk-sale.xyz/p/1',
    price: 100,
    previous_price: 900,
  });

  assert.ok(product.kauvio_score < 80);
  assert.equal(product.shop_risk_level, 'risky');
  assert.ok(product.ranking_reasons.includes('Shop sollte vor dem Kauf genau geprüft werden'));
});

test('applyKauvioShopTrustToProducts sorts trusted products higher', () => {
  const ranked = applyKauvioShopTrustToProducts([
    {
      id: 'risky',
      title: 'Risky Product',
      kauvio_score: 82,
      merchant: 'Risk Sale',
      url: 'http://risk-sale.xyz/p/1',
      price: 99,
      avg_90d_price: 600,
    },
    {
      id: 'trusted',
      title: 'Trusted Product',
      kauvio_score: 78,
      merchant: 'Swiss Shop AG',
      url: 'https://trusted.ch/p/2',
      return_policy: true,
      warranty: true,
      rating: 4.4,
      reviews_count: 50,
    },
  ]);

  assert.equal(ranked[0].id, 'trusted');
});
