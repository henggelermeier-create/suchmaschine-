const DEFAULT_ENDPOINT = '/api/kauvio/ai-search';

function buildUrl(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function searchKauvioAiProducts(query, options = {}) {
  const {
    endpoint = DEFAULT_ENDPOINT,
    limit = 24,
    region = 'CH',
    currency = 'CHF',
    signal,
  } = options;

  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) {
    return {
      ok: false,
      error: 'Bitte gib eine Suchanfrage ein.',
      products: [],
      advisor: null,
      intent: null,
      search_plan: null,
    };
  }

  const response = await fetch(buildUrl(endpoint, {
    q: normalizedQuery,
    limit,
    region,
    currency,
  }), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.error ?? `Kauvio AI Suche fehlgeschlagen (${response.status})`,
      products: [],
      advisor: null,
      intent: null,
      search_plan: null,
      meta: payload?.meta,
    };
  }

  return {
    ok: true,
    query: payload?.query ?? normalizedQuery,
    intent: payload?.intent ?? null,
    search_plan: payload?.search_plan ?? null,
    advisor: payload?.advisor ?? null,
    products: Array.isArray(payload?.products) ? payload.products : [],
    meta: payload?.meta ?? null,
  };
}

export function formatKauvioPrice(product, fallbackCurrency = 'CHF') {
  const price = Number.parseFloat(product?.price ?? product?.current_price);
  const currency = product?.currency ?? fallbackCurrency;

  if (!Number.isFinite(price)) return null;

  try {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency,
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${price.toFixed(price % 1 === 0 ? 0 : 2)} ${currency}`;
  }
}

export function getKauvioProductTitle(product) {
  return product?.title ?? product?.name ?? 'Produkt ohne Titel';
}

export function getKauvioProductUrl(product) {
  return product?.url ?? product?.product_url ?? product?.canonical_url ?? null;
}

export default {
  searchKauvioAiProducts,
  formatKauvioPrice,
  getKauvioProductTitle,
  getKauvioProductUrl,
};
