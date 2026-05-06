function toNumber(value, fallback = null) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function normalizePriceSnapshot(snapshot = {}) {
  const price = toNumber(snapshot.price);
  if (price === null || price < 0) {
    throw new Error('Price snapshot requires a valid non-negative price.');
  }

  return {
    canonical_product_id: snapshot.canonical_product_id ?? snapshot.canonicalProductId,
    offer_id: snapshot.offer_id ?? snapshot.offerId ?? null,
    merchant: snapshot.merchant ?? null,
    product_url: snapshot.product_url ?? snapshot.url ?? null,
    price,
    currency: snapshot.currency ?? 'CHF',
    captured_at: snapshot.captured_at ?? snapshot.capturedAt ?? new Date().toISOString(),
    payload: snapshot.payload ?? snapshot,
  };
}

export async function recordKauvioCanonicalPriceSnapshot(pool, snapshot = {}) {
  const normalized = normalizePriceSnapshot(snapshot);

  if (!normalized.canonical_product_id) {
    throw new Error('Price snapshot requires canonical_product_id.');
  }

  const result = await pool.query(`
    INSERT INTO kauvio_canonical_price_history (
      canonical_product_id,
      offer_id,
      merchant,
      product_url,
      price,
      currency,
      captured_at,
      payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::jsonb)
    RETURNING *
  `, [
    normalized.canonical_product_id,
    normalized.offer_id,
    normalized.merchant,
    normalized.product_url,
    normalized.price,
    normalized.currency,
    normalized.captured_at,
    json(normalized.payload),
  ]);

  return result.rows[0];
}

export async function recordKauvioCanonicalOfferPrices(pool, canonicalProduct = {}) {
  const canonicalProductId = canonicalProduct.canonical_product_id ?? canonicalProduct.id;
  const offers = Array.isArray(canonicalProduct.offers) ? canonicalProduct.offers : [];
  const snapshots = [];

  for (const offer of offers) {
    const price = toNumber(offer.price);
    if (price === null) continue;

    snapshots.push(await recordKauvioCanonicalPriceSnapshot(pool, {
      canonical_product_id: canonicalProductId,
      offer_id: offer.offer_id ?? offer.id,
      merchant: offer.merchant,
      product_url: offer.url ?? offer.product_url,
      price,
      currency: offer.currency ?? canonicalProduct.currency ?? 'CHF',
      payload: offer,
    }));
  }

  return snapshots;
}

export async function loadKauvioCanonicalPriceSummary(pool, canonicalProductId) {
  const result = await pool.query(`
    SELECT *
    FROM kauvio_canonical_price_summary
    WHERE canonical_product_id = $1
  `, [canonicalProductId]);

  return result.rows[0] ?? null;
}

export function calculateKauvioBuyTiming(summary = {}, currentPriceValue = null) {
  const currentPrice = toNumber(currentPriceValue ?? summary.latest_price);
  const avg90 = toNumber(summary.avg_90d_price ?? summary.avg_price);
  const lowest90 = toNumber(summary.lowest_90d_price ?? summary.lowest_price);
  const highest = toNumber(summary.highest_price);
  const sampleCount = toNumber(summary.sample_count, 0);

  if (currentPrice === null || sampleCount < 3) {
    return {
      decision: 'unknown',
      confidence: 0,
      reason: 'Noch zu wenig Preis-Historie für eine sichere Einschätzung.',
    };
  }

  const belowAvgPct = avg90 ? (avg90 - currentPrice) / avg90 : 0;
  const nearLowPct = lowest90 ? (currentPrice - lowest90) / lowest90 : 1;
  const rangePosition = highest && lowest90 && highest > lowest90
    ? (currentPrice - lowest90) / (highest - lowest90)
    : null;

  if (belowAvgPct >= 0.12 || nearLowPct <= 0.05 || (rangePosition !== null && rangePosition <= 0.2)) {
    return {
      decision: 'buy_now',
      confidence: Math.min(1, 0.65 + Math.max(belowAvgPct, 0) + Math.max(0.15 - nearLowPct, 0)),
      reason: 'Der aktuelle Preis liegt günstig im Vergleich zur bisherigen Preis-Historie.',
      current_price: currentPrice,
      avg_90d_price: avg90,
      lowest_90d_price: lowest90,
    };
  }

  if (belowAvgPct <= -0.08 || (rangePosition !== null && rangePosition >= 0.8)) {
    return {
      decision: 'wait',
      confidence: Math.min(1, 0.6 + Math.abs(belowAvgPct)),
      reason: 'Der aktuelle Preis wirkt im Vergleich zur Preis-Historie eher hoch.',
      current_price: currentPrice,
      avg_90d_price: avg90,
      lowest_90d_price: lowest90,
    };
  }

  return {
    decision: 'neutral',
    confidence: 0.55,
    reason: 'Der aktuelle Preis liegt ungefähr im normalen Bereich.',
    current_price: currentPrice,
    avg_90d_price: avg90,
    lowest_90d_price: lowest90,
  };
}

export async function enrichProductWithKauvioPriceHistory(pool, product = {}) {
  const canonicalProductId = product.canonical_product_id ?? product.id;
  if (!canonicalProductId) return product;

  const summary = await loadKauvioCanonicalPriceSummary(pool, canonicalProductId);
  if (!summary) return product;

  const timing = calculateKauvioBuyTiming(summary, product.price ?? product.best_offer?.price);

  return {
    ...product,
    price_history_summary: summary,
    buy_timing: timing,
  };
}

export default {
  recordKauvioCanonicalPriceSnapshot,
  recordKauvioCanonicalOfferPrices,
  loadKauvioCanonicalPriceSummary,
  calculateKauvioBuyTiming,
  enrichProductWithKauvioPriceHistory,
};
