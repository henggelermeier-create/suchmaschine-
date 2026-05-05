CREATE TABLE IF NOT EXISTS kauvio_search_feedback (
  id BIGSERIAL PRIMARY KEY,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'fits',
    'not_relevant',
    'too_expensive',
    'wrong_category',
    'bad_shop',
    'great_deal'
  )),
  query TEXT,
  product_id TEXT,
  product_url TEXT,
  product_title TEXT,
  kauvio_score NUMERIC,
  reason TEXT,
  session_id TEXT,
  search_id TEXT,
  intent JSONB,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kauvio_search_feedback_type
  ON kauvio_search_feedback (feedback_type);

CREATE INDEX IF NOT EXISTS idx_kauvio_search_feedback_product_id
  ON kauvio_search_feedback (product_id);

CREATE INDEX IF NOT EXISTS idx_kauvio_search_feedback_search_id
  ON kauvio_search_feedback (search_id);

CREATE INDEX IF NOT EXISTS idx_kauvio_search_feedback_created_at
  ON kauvio_search_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kauvio_search_feedback_intent
  ON kauvio_search_feedback USING GIN (intent);

CREATE OR REPLACE VIEW kauvio_search_feedback_summary AS
SELECT
  COALESCE(product_id, product_url, product_title, query) AS feedback_target,
  COUNT(*) AS total_feedback,
  COUNT(*) FILTER (WHERE feedback_type IN ('fits', 'great_deal')) AS positive_feedback,
  COUNT(*) FILTER (WHERE feedback_type IN ('not_relevant', 'too_expensive', 'wrong_category', 'bad_shop')) AS negative_feedback,
  COUNT(*) FILTER (WHERE feedback_type = 'too_expensive') AS too_expensive_count,
  COUNT(*) FILTER (WHERE feedback_type = 'wrong_category') AS wrong_category_count,
  COUNT(*) FILTER (WHERE feedback_type = 'bad_shop') AS bad_shop_count,
  MAX(created_at) AS last_feedback_at
FROM kauvio_search_feedback
GROUP BY COALESCE(product_id, product_url, product_title, query);
