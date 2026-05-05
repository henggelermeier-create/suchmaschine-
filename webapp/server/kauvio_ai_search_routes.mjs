import {
  extractKauvioSearchIntent,
  rankProductsForKauvio,
} from './kauvio_ai_product_search.mjs';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 80;

function parsePositiveInt(value, fallback, max = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeQueryPayload(req) {
  const source = req.method === 'GET' ? req.query : req.body;
  const query = String(source?.q ?? source?.query ?? '').trim();
  const limit = parsePositiveInt(source?.limit, DEFAULT_LIMIT);
  const region = String(source?.region ?? 'CH').trim() || 'CH';
  const currency = String(source?.currency ?? 'CHF').trim() || 'CHF';

  return { query, limit, region, currency };
}

function defaultProductMapper(row) {
  return {
    id: row.id ?? row.product_id ?? row.url ?? row.canonical_url,
    title: row.title ?? row.name ?? row.product_title,
    name: row.name,
    brand: row.brand,
    category: row.category ?? row.normalized_category,
    price: row.price ?? row.current_price ?? row.amount,
    currency: row.currency ?? 'CHF',
    merchant: row.merchant ?? row.shop ?? row.shop_name ?? row.domain,
    shop: row.shop ?? row.shop_name,
    url: row.url ?? row.product_url ?? row.canonical_url,
    image: row.image ?? row.image_url,
    description: row.description ?? row.summary,
    availability: row.availability ?? row.stock_status,
    in_stock: row.in_stock,
    rating: row.rating,
    reviews_count: row.reviews_count,
    return_policy: row.return_policy,
    warranty: row.warranty,
    trust_score: row.trust_score ?? row.shop_trust_score,
    avg_90d_price: row.avg_90d_price ?? row.price_avg_90d,
    previous_price: row.previous_price ?? row.original_price ?? row.list_price,
    ai_summary: row.ai_summary,
  };
}

function buildKeywordPredicate(intent) {
  const terms = intent.query_terms ?? [];
  const category = intent.category;

  return (product) => {
    const text = [
      product.title,
      product.name,
      product.brand,
      product.category,
      product.description,
      product.merchant,
      product.shop,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (category && text.includes(category.toLowerCase())) return true;
    if (!terms.length) return true;
    return terms.some((term) => text.includes(String(term).toLowerCase()));
  };
}

async function fallbackProductSearch({ products = [], intent, limit, mapProduct = defaultProductMapper }) {
  const mapped = products.map(mapProduct);
  const filtered = mapped
    .filter(buildKeywordPredicate(intent))
    .filter((product) => {
      if (!intent.filters?.max_price) return true;
      const price = Number.parseFloat(product.price ?? product.current_price);
      return !Number.isFinite(price) || price <= intent.filters.max_price * 1.25;
    })
    .slice(0, limit * 3);

  return filtered;
}

async function queryProductsWithProvider({ provider, query, intent, plan, limit }) {
  if (!provider) return null;

  if (typeof provider === 'function') {
    return provider({ query, intent, plan, limit });
  }

  if (typeof provider.searchProducts === 'function') {
    return provider.searchProducts({ query, intent, plan, limit });
  }

  if (typeof provider.kauvioSearchProducts === 'function') {
    return provider.kauvioSearchProducts({ query, intent, plan, limit });
  }

  return null;
}

export function createKauvioAiSearchHandler(options = {}) {
  const {
    productProvider,
    products = [],
    mapProduct = defaultProductMapper,
    logger = console,
  } = options;

  return async function kauvioAiSearchHandler(req, res) {
    const startedAt = Date.now();

    try {
      const payload = normalizeQueryPayload(req);

      if (!payload.query) {
        return res.status(400).json({
          ok: false,
          error: 'Missing query. Use q or query.',
        });
      }

      const intent = extractKauvioSearchIntent(payload.query, {
        region: payload.region,
        currency: payload.currency,
      });

      const planOnly = rankProductsForKauvio(payload.query, [], {
        region: payload.region,
        currency: payload.currency,
      });
      const plan = planOnly.plan;

      const providerRows = await queryProductsWithProvider({
        provider: productProvider,
        query: payload.query,
        intent,
        plan,
        limit: payload.limit,
      });

      const candidateProducts = Array.isArray(providerRows)
        ? providerRows.map(mapProduct)
        : await fallbackProductSearch({
            products,
            intent,
            limit: payload.limit,
            mapProduct,
          });

      const ranked = rankProductsForKauvio(payload.query, candidateProducts, {
        region: payload.region,
        currency: payload.currency,
      });

      const limitedProducts = ranked.products.slice(0, payload.limit);

      return res.json({
        ok: true,
        query: payload.query,
        intent: ranked.intent,
        search_plan: ranked.plan,
        advisor: ranked.advisor,
        products: limitedProducts,
        meta: {
          total_candidates: candidateProducts.length,
          returned: limitedProducts.length,
          limit: payload.limit,
          runtime_ms: Date.now() - startedAt,
          engine: 'kauvio_ai_product_search_v1',
        },
      });
    } catch (error) {
      logger.error?.('Kauvio AI search failed', error);
      return res.status(500).json({
        ok: false,
        error: 'Kauvio AI search failed.',
      });
    }
  };
}

export function registerKauvioAiSearchRoutes(app, options = {}) {
  const handler = createKauvioAiSearchHandler(options);

  app.get('/api/kauvio/ai-search', handler);
  app.post('/api/kauvio/ai-search', handler);

  // Compatibility alias for future migration of the default search endpoint.
  if (options.registerSearchAlias === true) {
    app.get('/api/search/ai', handler);
    app.post('/api/search/ai', handler);
  }

  return handler;
}

export { defaultProductMapper };

export default {
  createKauvioAiSearchHandler,
  registerKauvioAiSearchRoutes,
  defaultProductMapper,
};
