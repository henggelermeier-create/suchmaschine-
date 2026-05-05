const DEFAULT_WEIGHTS = {
  fits: 4,
  great_deal: 5,
  not_relevant: -6,
  too_expensive: -4,
  wrong_category: -7,
  bad_shop: -8,
};

function clamp(value, min = -20, max = 20) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getProductFeedbackKey(product) {
  return String(
    product?.id ??
    product?.product_id ??
    product?.url ??
    product?.product_url ??
    product?.canonical_url ??
    product?.title ??
    product?.name ??
    ''
  ).trim();
}

export function calculateKauvioFeedbackSignal(summary = {}, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };

  const positive = toNumber(summary.positive_feedback);
  const negative = toNumber(summary.negative_feedback);
  const total = toNumber(summary.total_feedback, positive + negative);

  const raw =
    toNumber(summary.fits_count) * weights.fits +
    toNumber(summary.great_deal_count) * weights.great_deal +
    toNumber(summary.not_relevant_count) * weights.not_relevant +
    toNumber(summary.too_expensive_count) * weights.too_expensive +
    toNumber(summary.wrong_category_count) * weights.wrong_category +
    toNumber(summary.bad_shop_count) * weights.bad_shop;

  const fallbackRaw = raw || (positive * 4 - negative * 5);
  const confidence = total <= 0 ? 0 : Math.min(1, Math.log10(total + 1) / 1.2);
  const scoreDelta = clamp(Math.round(fallbackRaw * confidence), -20, 20);

  return {
    score_delta: scoreDelta,
    confidence,
    total_feedback: total,
    positive_feedback: positive,
    negative_feedback: negative,
  };
}

export function applyKauvioFeedbackToProduct(product, feedbackSummary = null, options = {}) {
  if (!feedbackSummary) {
    return {
      ...product,
      feedback_signal: null,
    };
  }

  const signal = calculateKauvioFeedbackSignal(feedbackSummary, options);
  const baseScore = toNumber(product.kauvio_score, null);
  const nextScore = baseScore === null ? null : Math.max(0, Math.min(100, baseScore + signal.score_delta));

  const rankingReasons = Array.isArray(product.ranking_reasons) ? [...product.ranking_reasons] : [];

  if (signal.score_delta >= 5) {
    rankingReasons.push('Nutzerfeedback bestätigt dieses Ergebnis');
  } else if (signal.score_delta <= -5) {
    rankingReasons.push('Nutzerfeedback zeigt mögliche Schwächen');
  }

  return {
    ...product,
    kauvio_score: nextScore ?? product.kauvio_score,
    feedback_signal: signal,
    ranking_reasons: rankingReasons,
  };
}

export function applyKauvioFeedbackToProducts(products = [], feedbackByTarget = new Map(), options = {}) {
  return products
    .map((product) => {
      const key = getProductFeedbackKey(product);
      const summary = feedbackByTarget.get(key) ?? feedbackByTarget.get(product?.title) ?? feedbackByTarget.get(product?.name) ?? null;
      return applyKauvioFeedbackToProduct(product, summary, options);
    })
    .sort((a, b) => toNumber(b.kauvio_score) - toNumber(a.kauvio_score));
}

export async function loadKauvioFeedbackSummary(pool, products = []) {
  if (!pool || typeof pool.query !== 'function' || !products.length) {
    return new Map();
  }

  const targets = [...new Set(products.map(getProductFeedbackKey).filter(Boolean))];
  if (!targets.length) return new Map();

  const sql = `
    SELECT
      feedback_target,
      total_feedback,
      positive_feedback,
      negative_feedback,
      too_expensive_count,
      wrong_category_count,
      bad_shop_count,
      0::bigint AS fits_count,
      0::bigint AS great_deal_count,
      0::bigint AS not_relevant_count
    FROM kauvio_search_feedback_summary
    WHERE feedback_target = ANY($1::text[])
  `;

  const result = await pool.query(sql, [targets]);
  const map = new Map();

  for (const row of result.rows ?? []) {
    map.set(String(row.feedback_target), row);
  }

  return map;
}

export async function enrichProductsWithKauvioFeedback({ pool, products, logger = console } = {}) {
  try {
    const feedback = await loadKauvioFeedbackSummary(pool, products);
    return applyKauvioFeedbackToProducts(products, feedback);
  } catch (error) {
    logger.warn?.('Kauvio feedback scoring skipped.', {
      message: error.message,
      code: error.code,
    });
    return products;
  }
}

export default {
  calculateKauvioFeedbackSignal,
  applyKauvioFeedbackToProduct,
  applyKauvioFeedbackToProducts,
  loadKauvioFeedbackSummary,
  enrichProductsWithKauvioFeedback,
};
