const DEFAULT_FEEDBACK_ENDPOINT = '/api/kauvio/feedback';

export const KAU VIO_FEEDBACK_TYPES = {
  fits: 'fits',
  notRelevant: 'not_relevant',
  tooExpensive: 'too_expensive',
  wrongCategory: 'wrong_category',
  badShop: 'bad_shop',
  greatDeal: 'great_deal',
};

export async function sendKauvioFeedback(payload, options = {}) {
  const {
    endpoint = DEFAULT_FEEDBACK_ENDPOINT,
    signal,
  } = options;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error: body?.error ?? `Feedback konnte nicht gespeichert werden (${response.status})`,
    };
  }

  return body ?? { ok: true };
}

export function buildProductFeedbackPayload({ feedbackType, product, query, intent, searchId, sessionId, reason }) {
  return {
    feedback_type: feedbackType,
    query,
    product_id: product?.id ?? product?.product_id ?? null,
    product_url: product?.url ?? product?.product_url ?? product?.canonical_url ?? null,
    product_title: product?.title ?? product?.name ?? null,
    kauvio_score: product?.kauvio_score ?? null,
    reason: reason ?? null,
    search_id: searchId ?? null,
    session_id: sessionId ?? null,
    intent: intent ?? null,
  };
}

export default {
  KAU VIO_FEEDBACK_TYPES,
  sendKauvioFeedback,
  buildProductFeedbackPayload,
};
