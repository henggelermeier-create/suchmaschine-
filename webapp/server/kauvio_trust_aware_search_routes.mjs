import { createKauvioFeedbackAwareSearchHandler } from './kauvio_feedback_aware_search_routes.mjs';
import { applyKauvioShopTrustToProducts } from './kauvio_shop_trust.mjs';

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

function rebuildAdvisorWithTrust(advisor, products) {
  const top = products[0] ?? null;
  const riskyProducts = products
    .filter((product) => product.shop_risk_level === 'risky')
    .slice(0, 5)
    .map((product) => ({
      id: product.id ?? product.url ?? product.title,
      title: product.title ?? product.name,
      warning: product.shop_warnings?.[0] ?? 'Shop sollte vor dem Kauf geprüft werden.',
      shop_trust_score: product.shop_trust_score,
    }));

  const existingWarnings = Array.isArray(advisor?.warnings) ? advisor.warnings : [];

  return {
    ...(advisor ?? {}),
    summary: top
      ? `Beste Wahl: ${top.title ?? top.name} mit Kauvio Score ${top.kauvio_score}/100.`
      : advisor?.summary ?? 'Noch keine passende Produktempfehlung gefunden.',
    top_recommendation: top,
    warnings: [...existingWarnings, ...riskyProducts],
    shop_trust_optimized: true,
  };
}

export function createKauvioTrustAwareSearchHandler(options = {}) {
  const baseHandler = createKauvioFeedbackAwareSearchHandler(options);

  return async function kauvioTrustAwareSearchHandler(req, res) {
    const captured = createResponseCapture(res);

    await baseHandler(req, captured);

    if (captured.statusCode >= 400 || !captured.payload?.ok || !Array.isArray(captured.payload.products)) {
      return captured.flushTo(res);
    }

    const trustOptimizedProducts = applyKauvioShopTrustToProducts(captured.payload.products);

    const payload = {
      ...captured.payload,
      products: trustOptimizedProducts,
      advisor: rebuildAdvisorWithTrust(captured.payload.advisor, trustOptimizedProducts),
      meta: {
        ...(captured.payload.meta ?? {}),
        feedback_optimized: captured.payload.meta?.feedback_optimized ?? true,
        shop_trust_optimized: true,
        engine: 'kauvio_ai_product_search_trust_v1',
      },
    };

    return res.status(captured.statusCode).json(payload);
  };
}

export function registerKauvioTrustAwareSearchRoutes(app, options = {}) {
  const handler = createKauvioTrustAwareSearchHandler(options);

  app.get('/api/kauvio/ai-search-trust', handler);
  app.post('/api/kauvio/ai-search-trust', handler);

  if (options.replaceAiSearch === true) {
    app.get('/api/kauvio/ai-search', handler);
    app.post('/api/kauvio/ai-search', handler);
  }

  if (options.replaceFeedbackSearch === true) {
    app.get('/api/kauvio/ai-search-feedback', handler);
    app.post('/api/kauvio/ai-search-feedback', handler);
  }

  if (options.registerSearchAlias === true) {
    app.get('/api/search/ai-trust', handler);
    app.post('/api/search/ai-trust', handler);
  }

  return handler;
}

export default {
  createKauvioTrustAwareSearchHandler,
  registerKauvioTrustAwareSearchRoutes,
};
