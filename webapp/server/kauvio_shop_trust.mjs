const TRUST_WEIGHTS = {
  swiss_domain: 12,
  swiss_merchant_hint: 8,
  https_url: 10,
  return_policy: 10,
  warranty: 8,
  rating: 10,
  reviews: 8,
  suspicious_domain: -18,
  missing_merchant: -12,
  too_good_to_be_true_price: -18,
  bad_shop_feedback: -20,
  low_trust_score: -16,
};

const SUSPICIOUS_DOMAIN_PATTERNS = [
  /-outlet\./i,
  /-sale\./i,
  /discount/i,
  /clearance/i,
  /cheap/i,
  /replica/i,
  /fake/i,
  /\.top$/i,
  /\.xyz$/i,
  /\.click$/i,
  /\.shop$/i,
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toNumber(value, fallback = null) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function normalizeText(value = '') {
  return String(value).toLowerCase().trim();
}

function getMerchantText(product = {}) {
  return [product.merchant, product.shop, product.shop_name, product.domain, product.url]
    .filter(Boolean)
    .join(' ');
}

function hasSwissSignal(product = {}) {
  const merchantText = normalizeText(getMerchantText(product));
  const url = safeUrl(product.url ?? product.product_url ?? product.canonical_url);
  return merchantText.includes('swiss')
    || merchantText.includes('schweiz')
    || merchantText.includes('suisse')
    || merchantText.includes('ch')
    || url?.hostname?.endsWith('.ch');
}

function hasSuspiciousDomain(product = {}) {
  const url = safeUrl(product.url ?? product.product_url ?? product.canonical_url);
  const host = url?.hostname ?? normalizeText(product.domain ?? product.merchant ?? product.shop ?? '');
  return SUSPICIOUS_DOMAIN_PATTERNS.some((pattern) => pattern.test(host));
}

function isTooGoodToBeTrue(product = {}) {
  const price = toNumber(product.price ?? product.current_price);
  const avg90 = toNumber(product.avg_90d_price ?? product.price_avg_90d ?? product.average_price_90d);
  const previous = toNumber(product.previous_price ?? product.original_price ?? product.list_price);
  const reference = avg90 ?? previous;

  if (!price || !reference || reference <= 0) return false;
  return price < reference * 0.45;
}

export function calculateKauvioShopTrust(product = {}, options = {}) {
  const weights = { ...TRUST_WEIGHTS, ...(options.weights ?? {}) };
  let score = 55;
  const reasons = [];
  const warnings = [];

  const url = safeUrl(product.url ?? product.product_url ?? product.canonical_url);
  const merchantText = getMerchantText(product);
  const explicitTrust = toNumber(product.trust_score ?? product.shop_trust_score ?? product.merchant_trust_score);

  if (explicitTrust !== null) {
    score = explicitTrust;
    reasons.push('bestehender Händler-Vertrauensscore vorhanden');
  }

  if (url?.protocol === 'https:') {
    score += weights.https_url;
    reasons.push('Shop nutzt HTTPS');
  }

  if (url?.hostname?.endsWith('.ch')) {
    score += weights.swiss_domain;
    reasons.push('Schweizer .ch-Domain erkannt');
  } else if (hasSwissSignal(product)) {
    score += weights.swiss_merchant_hint;
    reasons.push('Schweizer Händler-Hinweis erkannt');
  }

  if (product.return_policy || product.has_return_policy) {
    score += weights.return_policy;
    reasons.push('Rückgabe-/Retourenhinweis vorhanden');
  }

  if (product.warranty || product.guarantee) {
    score += weights.warranty;
    reasons.push('Garantie-/Gewährleistungshinweis vorhanden');
  }

  const rating = toNumber(product.rating);
  if (rating !== null && rating >= 4) {
    score += weights.rating;
    reasons.push('gute Bewertungsmerkmale vorhanden');
  }

  const reviews = toNumber(product.reviews_count, 0);
  if (reviews >= 20) {
    score += weights.reviews;
    reasons.push('ausreichend viele Bewertungen vorhanden');
  }

  if (!merchantText.trim()) {
    score += weights.missing_merchant;
    warnings.push('Händlername fehlt oder ist unklar');
  }

  if (hasSuspiciousDomain(product)) {
    score += weights.suspicious_domain;
    warnings.push('Domain wirkt potenziell verdächtig');
  }

  if (isTooGoodToBeTrue(product)) {
    score += weights.too_good_to_be_true_price;
    warnings.push('Preis wirkt ungewöhnlich niedrig im Vergleich zum Referenzpreis');
  }

  const badShopFeedback = toNumber(product.feedback_signal?.bad_shop_count ?? product.bad_shop_count, 0);
  if (badShopFeedback > 0) {
    score += weights.bad_shop_feedback;
    warnings.push('Nutzerfeedback meldet Shop-Risiko');
  }

  if (explicitTrust !== null && explicitTrust < 35) {
    score += weights.low_trust_score;
    warnings.push('bestehender Vertrauensscore ist niedrig');
  }

  const trustScore = clamp(score);
  const riskLevel = trustScore >= 75 ? 'trusted' : trustScore >= 50 ? 'check' : 'risky';

  return {
    shop_trust_score: trustScore,
    shop_risk_level: riskLevel,
    shop_trust_reasons: reasons,
    shop_warnings: warnings,
  };
}

export function applyKauvioShopTrust(product = {}) {
  const trust = calculateKauvioShopTrust(product);
  const baseScore = toNumber(product.kauvio_score, null);
  const penalty = trust.shop_risk_level === 'risky' ? -12 : trust.shop_risk_level === 'check' ? -4 : 4;
  const nextScore = baseScore === null ? product.kauvio_score : clamp(baseScore + penalty);
  const rankingReasons = Array.isArray(product.ranking_reasons) ? [...product.ranking_reasons] : [];

  if (trust.shop_risk_level === 'trusted') {
    rankingReasons.push('Shop-Vertrauenssignale sind stark');
  } else if (trust.shop_risk_level === 'risky') {
    rankingReasons.push('Shop sollte vor dem Kauf genau geprüft werden');
  }

  return {
    ...product,
    ...trust,
    kauvio_score: nextScore,
    ranking_reasons: rankingReasons,
  };
}

export function applyKauvioShopTrustToProducts(products = []) {
  return products
    .map(applyKauvioShopTrust)
    .sort((a, b) => (toNumber(b.kauvio_score, 0) - toNumber(a.kauvio_score, 0)));
}

export default {
  calculateKauvioShopTrust,
  applyKauvioShopTrust,
  applyKauvioShopTrustToProducts,
};
