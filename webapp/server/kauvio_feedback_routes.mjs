const ALLOWED_FEEDBACK_TYPES = new Set([
  'fits',
  'not_relevant',
  'too_expensive',
  'wrong_category',
  'bad_shop',
  'great_deal',
]);

function sanitizeText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function buildFeedbackPayload(req) {
  const body = req.body ?? {};
  const feedbackType = sanitizeText(body.feedback_type ?? body.type, 50);

  return {
    feedback_type: feedbackType,
    query: sanitizeText(body.query, 300),
    product_id: sanitizeText(body.product_id ?? body.id, 200),
    product_url: sanitizeText(body.product_url ?? body.url, 1000),
    product_title: sanitizeText(body.product_title ?? body.title, 300),
    kauvio_score: body.kauvio_score === undefined ? null : Number.parseFloat(body.kauvio_score),
    reason: sanitizeText(body.reason, 500),
    session_id: sanitizeText(body.session_id, 200),
    search_id: sanitizeText(body.search_id, 200),
    intent: body.intent && typeof body.intent === 'object' ? body.intent : null,
    user_agent: sanitizeText(req.headers?.['user-agent'], 500),
    ip: getClientIp(req),
    created_at: new Date().toISOString(),
  };
}

function validateFeedback(payload) {
  if (!ALLOWED_FEEDBACK_TYPES.has(payload.feedback_type)) {
    return `Unsupported feedback_type. Allowed: ${[...ALLOWED_FEEDBACK_TYPES].join(', ')}`;
  }

  if (!payload.query && !payload.product_id && !payload.product_url) {
    return 'Feedback requires at least query, product_id, or product_url.';
  }

  if (payload.kauvio_score !== null && !Number.isFinite(payload.kauvio_score)) {
    return 'kauvio_score must be numeric when provided.';
  }

  return null;
}

async function defaultFeedbackSink({ pool, payload }) {
  if (!pool || typeof pool.query !== 'function') return null;

  const sql = `
    INSERT INTO kauvio_search_feedback (
      feedback_type,
      query,
      product_id,
      product_url,
      product_title,
      kauvio_score,
      reason,
      session_id,
      search_id,
      intent,
      user_agent,
      ip,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::timestamptz
    )
    RETURNING id, created_at
  `;

  const result = await pool.query(sql, [
    payload.feedback_type,
    payload.query || null,
    payload.product_id || null,
    payload.product_url || null,
    payload.product_title || null,
    payload.kauvio_score,
    payload.reason || null,
    payload.session_id || null,
    payload.search_id || null,
    payload.intent ? JSON.stringify(payload.intent) : null,
    payload.user_agent || null,
    payload.ip || null,
    payload.created_at,
  ]);

  return result.rows?.[0] ?? null;
}

export function createKauvioFeedbackHandler(options = {}) {
  const {
    pool,
    feedbackSink,
    logger = console,
  } = options;

  return async function kauvioFeedbackHandler(req, res) {
    try {
      const payload = buildFeedbackPayload(req);
      const validationError = validateFeedback(payload);

      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }

      const stored = feedbackSink
        ? await feedbackSink(payload)
        : await defaultFeedbackSink({ pool, payload });

      return res.status(201).json({
        ok: true,
        feedback: {
          id: stored?.id ?? null,
          feedback_type: payload.feedback_type,
          created_at: stored?.created_at ?? payload.created_at,
        },
      });
    } catch (error) {
      logger.error?.('Kauvio feedback failed', error);
      return res.status(500).json({ ok: false, error: 'Kauvio feedback failed.' });
    }
  };
}

export function registerKauvioFeedbackRoutes(app, options = {}) {
  const handler = createKauvioFeedbackHandler(options);
  app.post('/api/kauvio/feedback', handler);
  return handler;
}

export { ALLOWED_FEEDBACK_TYPES, buildFeedbackPayload, validateFeedback };

export default {
  createKauvioFeedbackHandler,
  registerKauvioFeedbackRoutes,
};
