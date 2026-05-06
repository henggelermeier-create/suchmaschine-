import { createKauvioTrustAwareSearchHandler } from './kauvio_trust_aware_search_routes.mjs';
import { enrichProductWithKauvioPriceHistory } from './kauvio_price_history.mjs';

function createResponseCapture(res) {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
    flushTo(realRes) {
      for (const [name, value] of Object.entries(this.headers)) {
        realRes.setHeader?.(name, value);
      }
      return realRes.status(this.statusCode).json(this.payload);
    },
  };
}

function rebuildAdvisorWithPriceHistory(advisor, products) {
  const top = products[0] ?? null;
  const buyNow = products.find((product) => product.buy_timing?.decision === 'buy_now') ?? null;
  const wait = products.find((product) => product.buy_timing?.decision === 'wait') ?? null;

  const warnings = Array.isArray(advisor?.warnings) ? [...advisor.warnings] : [];
  if (wait) {
    warnings.push({
      id: wait.id ?? wait.canonical_product_id ?? wait.url,
      title: wait.title ?? wait.name,
      warning: wait.buy_timing.reason,
      type: 'price_timing_wait',
    });
  }

  return {
    ...(advisor ?? {}),
    summary: top
      ? `Beste Wahl: ${top.title ?? top.name} mit Kauvio Score ${top.kauvio_score}/100.`
      : advisor?.summary ?? 'Noch keine passende Produktempfehlung gefunden.',
    top_recommendation: top,
    best_timing_deal: buyNow,
    warnings,
    price_history_optimized: true,
  };
}

export function createKauvioPriceAwareSearchHandler(options = {}) {
  const { pool, logger = console } = options;
  const baseHandler = createKauvioTrustAwareSearchHandler(options);

  return async function kauvioPriceAwareSearchHandler(req, res) {
    const captured = createResponseCapture(res);

    await baseHandler(req, captured);

    if (captured.statusCode >= 400 || !captured.payload?.ok || !Array.isArray(captured.payload.products)) {
      return captured.flushTo(res);
    }

    const enriched = [];
    for (const product of captured.payload.products) {
      try {
        enriched.push(await enrichProductWithKauvioPriceHistory(pool, product));
      } catch (error) {
        logger.warn?.('Kauvio price history enrichment skipped for product.', {
          id: product.id,
          canonical_product_id: product.canonical_product_id,
          message: error.message,
        });
        enriched.push(product);
      }
    }

    const payload = {
      ...captured.payload,
      products: enriched,
      advisor: rebuildAdvisorWithPriceHistory(captured.payload.advisor, enriched),
      meta: {
        ...(captured.payload.meta ?? {}),
        price_history_optimized: true,
        engine: 'kauvio_ai_product_search_price_v1',
      },
    };

    return res.status(captured.statusCode).json(payload);
  };
}

export function registerKauvioPriceAwareSearchRoutes(app, options = {}) {
  const handler = createKauvioPriceAwareSearchHandler(options);

  app.get('/api/kauvio/ai-search-price', handler);
  app.post('/api/kauvio/ai-search-price', handler);

  if (options.replaceAiSearch === true) {
    app.get('/api/kauvio/ai-search', handler);
    app.post('/api/kauvio/ai-search', handler);
  }

  if (options.replaceTrustSearch === true) {
    app.get('/api/kauvio/ai-search-trust', handler);
    app.post('/api/kauvio/ai-search-trust', handler);
  }

  if (options.registerSearchAlias === true) {
    app.get('/api/search/ai-price', handler);
    app.post('/api/search/ai-price', handler);
  }

  return handler;
}

export default {
  createKauvioPriceAwareSearchHandler,
  registerKauvioPriceAwareSearchRoutes,
};
