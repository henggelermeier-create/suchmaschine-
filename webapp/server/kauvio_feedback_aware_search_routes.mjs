import { createKauvioAiSearchHandler } from './kauvio_ai_search_routes.mjs';
import { enrichProductsWithKauvioFeedback } from './kauvio_feedback_scoring.mjs';

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

function rebuildAdvisorWithFeedback(advisor, products) {
  const top = products[0] ?? null;
  const bestDeal = products.find((product) => product.decision_badge?.toLowerCase().includes('deal'))
    ?? products.find((product) => product.kauvio_signals?.deal >= 75)
    ?? null;
  const budgetAlternative = products.find((product) => product.kauvio_signals?.budget_fit >= 90 && product !== top) ?? null;
  const premiumAlternative = products.find((product) => product.kauvio_signals?.quality >= 82 && product !== top) ?? null;

  return {
    ...(advisor ?? {}),
    summary: top
      ? `Beste Wahl: ${top.title ?? top.name} mit Kauvio Score ${top.kauvio_score}/100.`
      : advisor?.summary ?? 'Noch keine passende Produktempfehlung gefunden.',
    top_recommendation: top,
    best_deal: bestDeal,
    budget_alternative: budgetAlternative,
    premium_alternative: premiumAlternative,
    feedback_optimized: true,
  };
}

export function createKauvioFeedbackAwareSearchHandler(options = {}) {
  const {
    pool,
    logger = console,
  } = options;

  const baseHandler = createKauvioAiSearchHandler(options);

  return async function kauvioFeedbackAwareSearchHandler(req, res) {
    const captured = createResponseCapture(res);

    await baseHandler(req, captured);

    if (captured.statusCode >= 400 || !captured.payload?.ok || !Array.isArray(captured.payload.products)) {
      return captured.flushTo(res);
    }

    const feedbackOptimizedProducts = await enrichProductsWithKauvioFeedback({
      pool,
      products: captured.payload.products,
      logger,
    });

    const payload = {
      ...captured.payload,
      products: feedbackOptimizedProducts,
      advisor: rebuildAdvisorWithFeedback(captured.payload.advisor, feedbackOptimizedProducts),
      meta: {
        ...(captured.payload.meta ?? {}),
        feedback_optimized: true,
        engine: 'kauvio_ai_product_search_feedback_v1',
      },
    };

    return res.status(captured.statusCode).json(payload);
  };
}

export function registerKauvioFeedbackAwareSearchRoutes(app, options = {}) {
  const handler = createKauvioFeedbackAwareSearchHandler(options);

  app.get('/api/kauvio/ai-search-feedback', handler);
  app.post('/api/kauvio/ai-search-feedback', handler);

  if (options.replaceAiSearch === true) {
    app.get('/api/kauvio/ai-search', handler);
    app.post('/api/kauvio/ai-search', handler);
  }

  if (options.registerSearchAlias === true) {
    app.get('/api/search/ai-feedback', handler);
    app.post('/api/search/ai-feedback', handler);
  }

  return handler;
}

export default {
  createKauvioFeedbackAwareSearchHandler,
  registerKauvioFeedbackAwareSearchRoutes,
};
