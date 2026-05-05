import {
  buildKauvioProductFingerprint,
  findBestCanonicalMatch,
} from './kauvio_canonical_matching.mjs';

function json(value) {
  return JSON.stringify(value ?? {});
}

function normalizeCandidate(row = {}) {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    category: row.category,
    fingerprint: row.fingerprint,
    payload: row.payload,
  };
}

export async function loadKauvioCanonicalCandidates(pool, product = {}, options = {}) {
  const limit = options.limit ?? 50;
  const fingerprint = buildKauvioProductFingerprint(product);

  const result = await pool.query(`
    SELECT id, title, brand, category, fingerprint, payload
    FROM kauvio_canonical_products
    WHERE
      ($1::text IS NULL OR brand IS NULL OR LOWER(brand) = LOWER($1))
      AND ($2::text IS NULL OR category IS NULL OR LOWER(category) = LOWER($2))
    ORDER BY updated_at DESC
    LIMIT $3
  `, [product.brand ?? null, product.category ?? null, limit]);

  return {
    fingerprint,
    candidates: (result.rows ?? []).map(normalizeCandidate),
  };
}

export async function createKauvioCanonicalProduct(pool, product = {}) {
  const fingerprint = buildKauvioProductFingerprint(product);
  const canonicalKey = fingerprint.fingerprint || `${product.title ?? 'product'}:${product.url ?? Date.now()}`;

  const result = await pool.query(`
    INSERT INTO kauvio_canonical_products (
      canonical_key,
      title,
      brand,
      category,
      fingerprint,
      payload
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (canonical_key) DO UPDATE SET
      title = COALESCE(EXCLUDED.title, kauvio_canonical_products.title),
      brand = COALESCE(EXCLUDED.brand, kauvio_canonical_products.brand),
      category = COALESCE(EXCLUDED.category, kauvio_canonical_products.category),
      fingerprint = COALESCE(EXCLUDED.fingerprint, kauvio_canonical_products.fingerprint),
      payload = kauvio_canonical_products.payload || EXCLUDED.payload
    RETURNING *
  `, [
    canonicalKey,
    product.title ?? product.name ?? 'Produkt',
    product.brand ?? null,
    product.category ?? null,
    fingerprint.fingerprint,
    json({ fingerprint, source_product: product }),
  ]);

  return result.rows[0];
}

export async function upsertKauvioCanonicalOffer(pool, canonicalProduct, product = {}, match = {}) {
  const result = await pool.query(`
    INSERT INTO kauvio_canonical_product_offers (
      canonical_product_id,
      ingested_product_id,
      product_url,
      merchant,
      price,
      currency,
      match_score,
      match_reasons,
      payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
    ON CONFLICT (canonical_product_id, product_url) DO UPDATE SET
      merchant = COALESCE(EXCLUDED.merchant, kauvio_canonical_product_offers.merchant),
      price = COALESCE(EXCLUDED.price, kauvio_canonical_product_offers.price),
      currency = COALESCE(EXCLUDED.currency, kauvio_canonical_product_offers.currency),
      match_score = COALESCE(EXCLUDED.match_score, kauvio_canonical_product_offers.match_score),
      match_reasons = EXCLUDED.match_reasons,
      payload = EXCLUDED.payload,
      updated_at = NOW()
    RETURNING *
  `, [
    canonicalProduct.id,
    product.ingested_product_id ?? product.id ?? null,
    product.url ?? product.product_url ?? null,
    product.merchant ?? product.shop ?? null,
    product.price ?? product.current_price ?? null,
    product.currency ?? 'CHF',
    match.score ?? null,
    json(match.reasons ?? []),
    json(product),
  ]);

  return result.rows[0];
}

export async function matchAndStoreKauvioCanonicalProduct(pool, product = {}, options = {}) {
  const threshold = options.threshold ?? 72;
  const { candidates } = await loadKauvioCanonicalCandidates(pool, product, options);
  const match = findBestCanonicalMatch(product, candidates, { threshold });
  const canonical = match.matched
    ? match.canonical
    : await createKauvioCanonicalProduct(pool, product);

  const offer = await upsertKauvioCanonicalOffer(pool, canonical, product, match);

  return {
    matched: match.matched,
    canonical,
    offer,
    score: match.score,
    reasons: match.reasons,
  };
}

export async function matchAndStoreKauvioCanonicalProducts(pool, products = [], options = {}) {
  const results = [];
  for (const product of products) {
    results.push(await matchAndStoreKauvioCanonicalProduct(pool, product, options));
  }
  return results;
}

export default {
  loadKauvioCanonicalCandidates,
  createKauvioCanonicalProduct,
  upsertKauvioCanonicalOffer,
  matchAndStoreKauvioCanonicalProduct,
  matchAndStoreKauvioCanonicalProducts,
};
