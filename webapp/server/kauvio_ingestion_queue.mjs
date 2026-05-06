import {
  ingestSearchResults,
  ingestShopUrl,
  normalizeIngestedProduct,
} from './kauvio_ai_ingestion.mjs';
import {
  detectSwissShopAdapter,
  ingestSwissShopUrl,
} from './kauvio_swiss_shop_adapters.mjs';
import { matchAndStoreKauvioCanonicalProduct } from './kauvio_canonical_matching_store.mjs';
import { recordKauvioCanonicalPriceSnapshot } from './kauvio_price_history.mjs';

const DEFAULT_WORKER_ID = `kauvio-worker-${process.pid}`;

function json(value) {
  return JSON.stringify(value ?? {});
}

function toNumber(value, fallback = null) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeJobType(jobType) {
  if (!['shop_url', 'search_results'].includes(jobType)) {
    throw new Error(`Unsupported Kauvio ingestion job type: ${jobType}`);
  }
  return jobType;
}

export async function enqueueKauvioIngestionJob(pool, { jobType, payload, priority = 100, maxAttempts = 3 }) {
  const safeJobType = sanitizeJobType(jobType);
  const result = await pool.query(`
    INSERT INTO kauvio_ingestion_jobs (job_type, payload, priority, max_attempts)
    VALUES ($1, $2::jsonb, $3, $4)
    RETURNING *
  `, [safeJobType, json(payload), priority, maxAttempts]);

  return result.rows[0];
}

export async function enqueueShopUrl(pool, url, options = {}) {
  const adapter = detectSwissShopAdapter(url);
  return enqueueKauvioIngestionJob(pool, {
    jobType: 'shop_url',
    payload: { url, adapter_id: adapter?.id ?? null, ...options.payload },
    priority: options.priority ?? (adapter ? 80 : 100),
    maxAttempts: options.maxAttempts ?? 3,
  });
}

export async function enqueueSearchResults(pool, results, options = {}) {
  return enqueueKauvioIngestionJob(pool, {
    jobType: 'search_results',
    payload: { results, ...options.payload },
    priority: options.priority ?? 110,
    maxAttempts: options.maxAttempts ?? 3,
  });
}

export async function claimKauvioIngestionJob(pool, options = {}) {
  const workerId = options.workerId ?? DEFAULT_WORKER_ID;
  const staleAfterMinutes = Number.parseInt(options.staleAfterMinutes ?? '15', 10);

  const result = await pool.query(`
    WITH next_job AS (
      SELECT id
      FROM kauvio_ingestion_jobs
      WHERE
        (
          status = 'pending'
          OR (
            status = 'processing'
            AND locked_at < NOW() - ($2::int * INTERVAL '1 minute')
          )
        )
        AND attempts < max_attempts
      ORDER BY priority ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE kauvio_ingestion_jobs job
    SET
      status = 'processing',
      attempts = attempts + 1,
      locked_at = NOW(),
      locked_by = $1,
      last_error = NULL
    FROM next_job
    WHERE job.id = next_job.id
    RETURNING job.*
  `, [workerId, staleAfterMinutes]);

  return result.rows[0] ?? null;
}

export async function saveKauvioIngestedProduct(pool, product) {
  const normalized = normalizeIngestedProduct(product);
  const payload = {
    ...normalized,
    adapter_id: product.adapter_id ?? null,
    adapter_name: product.adapter_name ?? null,
    category_hints: product.category_hints ?? null,
  };

  const result = await pool.query(`
    INSERT INTO kauvio_ingested_products (
      title,
      brand,
      category,
      price,
      currency,
      merchant,
      url,
      image,
      description,
      availability,
      domain,
      raw_source,
      payload
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
    )
    ON CONFLICT (url) DO UPDATE SET
      title = COALESCE(EXCLUDED.title, kauvio_ingested_products.title),
      brand = COALESCE(EXCLUDED.brand, kauvio_ingested_products.brand),
      category = COALESCE(EXCLUDED.category, kauvio_ingested_products.category),
      price = COALESCE(EXCLUDED.price, kauvio_ingested_products.price),
      currency = COALESCE(EXCLUDED.currency, kauvio_ingested_products.currency),
      merchant = COALESCE(EXCLUDED.merchant, kauvio_ingested_products.merchant),
      image = COALESCE(EXCLUDED.image, kauvio_ingested_products.image),
      description = COALESCE(EXCLUDED.description, kauvio_ingested_products.description),
      availability = COALESCE(EXCLUDED.availability, kauvio_ingested_products.availability),
      domain = COALESCE(EXCLUDED.domain, kauvio_ingested_products.domain),
      raw_source = COALESCE(EXCLUDED.raw_source, kauvio_ingested_products.raw_source),
      payload = EXCLUDED.payload,
      last_seen_at = NOW()
    RETURNING *
  `, [
    normalized.title || null,
    normalized.brand || null,
    normalized.category || null,
    normalized.price || null,
    normalized.currency || 'CHF',
    normalized.merchant || null,
    normalized.url || null,
    normalized.image || null,
    normalized.description || null,
    normalized.availability || null,
    normalized.domain || null,
    normalized.raw_source || null,
    json(payload),
  ]);

  return result.rows[0];
}

export async function saveAndMatchKauvioIngestedProduct(pool, product, options = {}) {
  const stored = await saveKauvioIngestedProduct(pool, product);
  const productForMatching = {
    ...product,
    ...stored,
    ingested_product_id: stored.id,
  };

  if (options.skipCanonicalMatching === true) {
    return { stored, canonical: null, priceSnapshot: null };
  }

  const canonical = await matchAndStoreKauvioCanonicalProduct(pool, productForMatching, {
    threshold: options.canonicalThreshold ?? 72,
  });

  let priceSnapshot = null;
  const price = toNumber(productForMatching.price);
  const canonicalProductId = canonical?.canonical?.id;
  if (price !== null && canonicalProductId && options.skipPriceHistory !== true) {
    priceSnapshot = await recordKauvioCanonicalPriceSnapshot(pool, {
      canonical_product_id: canonicalProductId,
      offer_id: canonical.offer?.id ?? null,
      merchant: productForMatching.merchant,
      product_url: productForMatching.url,
      price,
      currency: productForMatching.currency ?? 'CHF',
      payload: productForMatching,
    });
  }

  return { stored, canonical, priceSnapshot };
}

export async function completeKauvioIngestionJob(pool, job, resultPayload = {}) {
  const result = await pool.query(`
    UPDATE kauvio_ingestion_jobs
    SET status = 'completed', completed_at = NOW(), payload = payload || $2::jsonb
    WHERE id = $1
    RETURNING *
  `, [job.id, json({ result: resultPayload })]);

  return result.rows[0];
}

export async function failKauvioIngestionJob(pool, job, error) {
  const shouldRetry = Number(job.attempts ?? 0) < Number(job.max_attempts ?? 3);
  const result = await pool.query(`
    UPDATE kauvio_ingestion_jobs
    SET status = $2, last_error = $3, locked_at = NULL, locked_by = NULL
    WHERE id = $1
    RETURNING *
  `, [job.id, shouldRetry ? 'pending' : 'failed', String(error?.message ?? error).slice(0, 2000)]);

  return result.rows[0];
}

export async function processKauvioIngestionJob(pool, job, options = {}) {
  const logger = options.logger ?? console;
  const payload = job.payload ?? {};

  if (job.job_type === 'shop_url') {
    const hasAdapter = payload.adapter_id || detectSwissShopAdapter(payload.url);
    const ingest = hasAdapter ? ingestSwissShopUrl : ingestShopUrl;
    let canonicalResult = null;
    let priceSnapshot = null;
    const product = await ingest({
      url: payload.url,
      fetcher: options.fetcher ?? fetch,
      storeProduct: async (item) => {
        const saved = await saveAndMatchKauvioIngestedProduct(pool, item, options);
        canonicalResult = saved.canonical;
        priceSnapshot = saved.priceSnapshot;
        return saved.stored;
      },
      logger,
    });
    await completeKauvioIngestionJob(pool, job, {
      products: 1,
      url: product.url,
      adapter_id: product.adapter_id ?? null,
      canonical_product_id: canonicalResult?.canonical?.id ?? null,
      canonical_matched: canonicalResult?.matched ?? false,
      price_snapshot_id: priceSnapshot?.id ?? null,
    });
    return { products: [product], canonicals: canonicalResult ? [canonicalResult] : [], priceSnapshots: priceSnapshot ? [priceSnapshot] : [] };
  }

  if (job.job_type === 'search_results') {
    const canonicalResults = [];
    const priceSnapshots = [];
    const products = await ingestSearchResults({
      results: Array.isArray(payload.results) ? payload.results : [],
      storeProduct: async (item) => {
        const saved = await saveAndMatchKauvioIngestedProduct(pool, item, options);
        if (saved.canonical) canonicalResults.push(saved.canonical);
        if (saved.priceSnapshot) priceSnapshots.push(saved.priceSnapshot);
        return saved.stored;
      },
    });
    await completeKauvioIngestionJob(pool, job, {
      products: products.length,
      canonicals: canonicalResults.length,
      price_snapshots: priceSnapshots.length,
    });
    return { products, canonicals: canonicalResults, priceSnapshots };
  }

  throw new Error(`Unsupported job type: ${job.job_type}`);
}

export async function runKauvioIngestionWorkerOnce(pool, options = {}) {
  const logger = options.logger ?? console;
  const job = await claimKauvioIngestionJob(pool, options);

  if (!job) {
    return { processed: false, job: null };
  }

  try {
    const result = await processKauvioIngestionJob(pool, job, options);
    logger.info?.('Kauvio ingestion job completed.', { id: job.id, job_type: job.job_type });
    return { processed: true, job, result };
  } catch (error) {
    await failKauvioIngestionJob(pool, job, error);
    logger.error?.('Kauvio ingestion job failed.', { id: job.id, message: error.message });
    return { processed: false, job, error };
  }
}

export default {
  enqueueKauvioIngestionJob,
  enqueueShopUrl,
  enqueueSearchResults,
  claimKauvioIngestionJob,
  saveKauvioIngestedProduct,
  saveAndMatchKauvioIngestedProduct,
  completeKauvioIngestionJob,
  failKauvioIngestionJob,
  processKauvioIngestionJob,
  runKauvioIngestionWorkerOnce,
};
