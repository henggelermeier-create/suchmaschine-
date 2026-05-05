const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

function clampLimit(limit, fallback = DEFAULT_LIMIT) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß.\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueTerms(terms = []) {
  return [...new Set(terms.map(normalizeText).filter((term) => term.length > 1))];
}

function buildSearchTokens({ query, intent }) {
  return uniqueTerms([
    ...(intent?.query_terms ?? []),
    intent?.category,
    ...(intent?.use_cases ?? []),
    query,
  ]).slice(0, 16);
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function buildWhereClause({ tokens, intent, startIndex = 1 }) {
  const clauses = [];
  const values = [];
  let index = startIndex;

  if (tokens.length) {
    const tokenClauses = tokens.map((token) => {
      values.push(`%${escapeLike(token)}%`);
      return `(LOWER(search_text) LIKE LOWER($${index++}) ESCAPE '\\')`;
    });
    clauses.push(`(${tokenClauses.join(' OR ')})`);
  }

  if (intent?.filters?.max_price) {
    values.push(Number(intent.filters.max_price) * 1.25);
    clauses.push(`(price IS NULL OR price <= $${index++})`);
  }

  if (intent?.filters?.currency) {
    values.push(intent.filters.currency);
    clauses.push(`(currency IS NULL OR currency = $${index++})`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
    nextIndex: index,
  };
}

const KAUVIO_CANONICAL_PRODUCTS_SQL = ({ where, limitParam }) => `
  SELECT
    id,
    title,
    brand,
    category,
    price,
    currency,
    merchant,
    shop,
    url,
    image,
    description,
    availability,
    in_stock,
    rating,
    reviews_count,
    return_policy,
    warranty,
    trust_score,
    avg_90d_price,
    previous_price,
    ai_summary,
    canonical_product_id,
    canonical_key,
    offer_count,
    offers,
    best_offer
  FROM (
    SELECT
      cp.id AS id,
      cp.id AS canonical_product_id,
      cp.canonical_key,
      cp.title,
      cp.brand,
      cp.category,
      MIN(o.price) FILTER (WHERE o.price IS NOT NULL) AS price,
      COALESCE(MIN(o.currency), 'CHF') AS currency,
      (ARRAY_AGG(o.merchant ORDER BY o.price ASC NULLS LAST))[1] AS merchant,
      (ARRAY_AGG(o.merchant ORDER BY o.price ASC NULLS LAST))[1] AS shop,
      (ARRAY_AGG(o.product_url ORDER BY o.price ASC NULLS LAST))[1] AS url,
      NULL::text AS image,
      cp.payload->>'description' AS description,
      NULL::text AS availability,
      TRUE AS in_stock,
      NULL::numeric AS rating,
      NULL::integer AS reviews_count,
      NULL::text AS return_policy,
      NULL::text AS warranty,
      NULL::numeric AS trust_score,
      NULL::numeric AS avg_90d_price,
      NULL::numeric AS previous_price,
      cp.payload->>'ai_summary' AS ai_summary,
      COUNT(o.id)::integer AS offer_count,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'offer_id', o.id,
            'merchant', o.merchant,
            'price', o.price,
            'currency', o.currency,
            'url', o.product_url,
            'match_score', o.match_score,
            'payload', o.payload
          ) ORDER BY o.price ASC NULLS LAST
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'::jsonb
      ) AS offers,
      (COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'offer_id', o.id,
            'merchant', o.merchant,
            'price', o.price,
            'currency', o.currency,
            'url', o.product_url,
            'match_score', o.match_score,
            'payload', o.payload
          ) ORDER BY o.price ASC NULLS LAST
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'::jsonb
      )->0) AS best_offer,
      LOWER(CONCAT_WS(' ', cp.title, cp.brand, cp.category, cp.fingerprint, cp.payload::text, STRING_AGG(COALESCE(o.merchant, '') || ' ' || COALESCE(o.product_url, ''), ' '))) AS search_text
    FROM kauvio_canonical_products cp
    LEFT JOIN kauvio_canonical_product_offers o
      ON o.canonical_product_id = cp.id
    GROUP BY cp.id, cp.canonical_key, cp.title, cp.brand, cp.category, cp.fingerprint, cp.payload
  ) canonical_candidates
  ${where}
  ORDER BY
    offer_count DESC,
    CASE WHEN price IS NULL THEN 1 ELSE 0 END,
    price ASC NULLS LAST,
    title ASC
  LIMIT ${limitParam}
`;

const PRODUCT_SEARCH_SQL = ({ where, limitParam }) => `
  SELECT
    id,
    title,
    brand,
    category,
    price,
    currency,
    merchant,
    shop,
    url,
    image,
    description,
    availability,
    in_stock,
    rating,
    reviews_count,
    return_policy,
    warranty,
    trust_score,
    avg_90d_price,
    previous_price,
    ai_summary
  FROM (
    SELECT
      id,
      COALESCE(title, name, product_title) AS title,
      brand,
      COALESCE(category, normalized_category) AS category,
      COALESCE(price, current_price, amount) AS price,
      COALESCE(currency, 'CHF') AS currency,
      COALESCE(merchant, shop, shop_name, domain) AS merchant,
      COALESCE(shop, shop_name) AS shop,
      COALESCE(url, product_url, canonical_url) AS url,
      COALESCE(image, image_url) AS image,
      COALESCE(description, summary) AS description,
      COALESCE(availability, stock_status) AS availability,
      in_stock,
      rating,
      reviews_count,
      return_policy,
      warranty,
      COALESCE(trust_score, shop_trust_score) AS trust_score,
      COALESCE(avg_90d_price, price_avg_90d) AS avg_90d_price,
      COALESCE(previous_price, original_price, list_price) AS previous_price,
      ai_summary,
      LOWER(CONCAT_WS(' ', title, name, product_title, brand, category, normalized_category, description, summary, merchant, shop, shop_name, domain)) AS search_text
    FROM product_search_index
  ) indexed_products
  ${where}
  ORDER BY
    CASE WHEN price IS NULL THEN 1 ELSE 0 END,
    CASE WHEN in_stock IS TRUE THEN 0 ELSE 1 END,
    title ASC
  LIMIT ${limitParam}
`;

const CANONICAL_PRODUCTS_SQL = ({ where, limitParam }) => `
  SELECT
    id,
    title,
    brand,
    category,
    price,
    currency,
    merchant,
    shop,
    url,
    image,
    description,
    availability,
    in_stock,
    rating,
    reviews_count,
    return_policy,
    warranty,
    trust_score,
    avg_90d_price,
    previous_price,
    ai_summary
  FROM (
    SELECT
      cp.id,
      COALESCE(cp.title, cp.name, cp.product_title) AS title,
      cp.brand,
      COALESCE(cp.category, cp.normalized_category) AS category,
      COALESCE(cp.price, cp.current_price, pp.price, pp.current_price, pp.amount) AS price,
      COALESCE(cp.currency, pp.currency, 'CHF') AS currency,
      COALESCE(cp.merchant, cp.shop, cp.shop_name, pp.merchant, pp.shop, pp.shop_name, pp.domain) AS merchant,
      COALESCE(cp.shop, cp.shop_name, pp.shop, pp.shop_name) AS shop,
      COALESCE(cp.url, cp.product_url, cp.canonical_url, pp.url, pp.product_url) AS url,
      COALESCE(cp.image, cp.image_url, pp.image, pp.image_url) AS image,
      COALESCE(cp.description, cp.summary, pp.description, pp.summary) AS description,
      COALESCE(cp.availability, cp.stock_status, pp.availability, pp.stock_status) AS availability,
      COALESCE(cp.in_stock, pp.in_stock) AS in_stock,
      COALESCE(cp.rating, pp.rating) AS rating,
      COALESCE(cp.reviews_count, pp.reviews_count) AS reviews_count,
      COALESCE(cp.return_policy, pp.return_policy) AS return_policy,
      COALESCE(cp.warranty, pp.warranty) AS warranty,
      COALESCE(cp.trust_score, cp.shop_trust_score, pp.trust_score, pp.shop_trust_score) AS trust_score,
      COALESCE(cp.avg_90d_price, cp.price_avg_90d, pp.avg_90d_price, pp.price_avg_90d) AS avg_90d_price,
      COALESCE(cp.previous_price, cp.original_price, cp.list_price, pp.previous_price, pp.original_price, pp.list_price) AS previous_price,
      COALESCE(cp.ai_summary, pp.ai_summary) AS ai_summary,
      LOWER(CONCAT_WS(' ', cp.title, cp.name, cp.product_title, cp.brand, cp.category, cp.normalized_category, cp.description, cp.summary, pp.title, pp.name, pp.product_title, pp.brand, pp.category, pp.description, pp.summary, cp.merchant, cp.shop, cp.shop_name, pp.merchant, pp.shop, pp.shop_name, pp.domain)) AS search_text
    FROM canonical_products cp
    LEFT JOIN product_prices pp
      ON pp.canonical_product_id = cp.id
  ) canonical_candidates
  ${where}
  ORDER BY
    CASE WHEN price IS NULL THEN 1 ELSE 0 END,
    CASE WHEN in_stock IS TRUE THEN 0 ELSE 1 END,
    title ASC
  LIMIT ${limitParam}
`;

const SIMPLE_PRODUCTS_SQL = ({ where, limitParam }) => `
  SELECT
    id,
    title,
    brand,
    category,
    price,
    currency,
    merchant,
    shop,
    url,
    image,
    description,
    availability,
    in_stock,
    rating,
    reviews_count,
    return_policy,
    warranty,
    trust_score,
    avg_90d_price,
    previous_price,
    ai_summary
  FROM (
    SELECT
      id,
      COALESCE(title, name) AS title,
      brand,
      category,
      COALESCE(price, current_price, amount) AS price,
      COALESCE(currency, 'CHF') AS currency,
      COALESCE(merchant, shop, shop_name, domain) AS merchant,
      COALESCE(shop, shop_name) AS shop,
      COALESCE(url, product_url) AS url,
      COALESCE(image, image_url) AS image,
      description,
      COALESCE(availability, stock_status) AS availability,
      in_stock,
      rating,
      reviews_count,
      return_policy,
      warranty,
      COALESCE(trust_score, shop_trust_score) AS trust_score,
      COALESCE(avg_90d_price, price_avg_90d) AS avg_90d_price,
      COALESCE(previous_price, original_price, list_price) AS previous_price,
      ai_summary,
      LOWER(CONCAT_WS(' ', title, name, brand, category, description, merchant, shop, shop_name, domain)) AS search_text
    FROM products
  ) products_candidates
  ${where}
  ORDER BY
    CASE WHEN price IS NULL THEN 1 ELSE 0 END,
    CASE WHEN in_stock IS TRUE THEN 0 ELSE 1 END,
    title ASC
  LIMIT ${limitParam}
`;

function isMissingRelationError(error) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(String(error?.message ?? ''));
}

function isMissingColumnError(error) {
  return error?.code === '42703' || /column .* does not exist/i.test(String(error?.message ?? ''));
}

async function runFirstWorkingQuery(pool, builders, queryContext) {
  const errors = [];

  for (const buildSql of builders) {
    const { where, values, nextIndex } = buildWhereClause(queryContext);
    const limit = clampLimit(queryContext.limit);
    const limitParam = `$${nextIndex}`;
    const sql = buildSql({ where, limitParam });
    const params = [...values, limit];

    try {
      const result = await pool.query(sql, params);
      return result.rows ?? [];
    } catch (error) {
      errors.push(error);
      if (!isMissingRelationError(error) && !isMissingColumnError(error)) {
        throw error;
      }
    }
  }

  const lastError = errors.at(-1);
  if (lastError) {
    const wrapped = new Error(`No compatible product table/view found for Kauvio AI search: ${lastError.message}`);
    wrapped.cause = lastError;
    throw wrapped;
  }

  return [];
}

export function createKauvioProductProvider({ pool, logger = console } = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('createKauvioProductProvider requires a PostgreSQL-compatible pool with query(sql, params).');
  }

  return {
    async searchProducts({ query, intent, limit = DEFAULT_LIMIT }) {
      const tokens = buildSearchTokens({ query, intent });
      const context = { tokens, intent, limit };

      try {
        return await runFirstWorkingQuery(pool, [
          KAUVIO_CANONICAL_PRODUCTS_SQL,
          PRODUCT_SEARCH_SQL,
          CANONICAL_PRODUCTS_SQL,
          SIMPLE_PRODUCTS_SQL,
        ], context);
      } catch (error) {
        logger.error?.('Kauvio product provider failed', {
          message: error.message,
          code: error.code,
          query,
          category: intent?.category,
        });
        throw error;
      }
    },
  };
}

export function createInMemoryKauvioProductProvider(products = []) {
  return {
    async searchProducts({ query, intent, limit = DEFAULT_LIMIT }) {
      const tokens = buildSearchTokens({ query, intent });
      const maxPrice = intent?.filters?.max_price ? Number(intent.filters.max_price) * 1.25 : null;

      return products
        .filter((product) => {
          const text = normalizeText([
            product.title,
            product.name,
            product.brand,
            product.category,
            product.description,
            product.merchant,
            product.shop,
          ].filter(Boolean).join(' '));
          return !tokens.length || tokens.some((token) => text.includes(token));
        })
        .filter((product) => {
          if (!maxPrice) return true;
          const price = Number.parseFloat(product.price ?? product.current_price);
          return !Number.isFinite(price) || price <= maxPrice;
        })
        .slice(0, clampLimit(limit));
    },
  };
}

export default {
  createKauvioProductProvider,
  createInMemoryKauvioProductProvider,
};
