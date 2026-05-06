CREATE TABLE IF NOT EXISTS kauvio_canonical_price_history (
  id BIGSERIAL PRIMARY KEY,
  canonical_product_id BIGINT NOT NULL REFERENCES kauvio_canonical_products(id) ON DELETE CASCADE,
  offer_id BIGINT REFERENCES kauvio_canonical_product_offers(id) ON DELETE SET NULL,
  merchant TEXT,
  product_url TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_price_history_product_time
  ON kauvio_canonical_price_history (canonical_product_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_price_history_offer_time
  ON kauvio_canonical_price_history (offer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_price_history_price
  ON kauvio_canonical_price_history (canonical_product_id, price);

CREATE OR REPLACE VIEW kauvio_canonical_price_summary AS
SELECT
  canonical_product_id,
  COUNT(*) AS sample_count,
  MIN(price) AS lowest_price,
  MAX(price) AS highest_price,
  AVG(price) AS avg_price,
  MIN(price) FILTER (WHERE captured_at >= NOW() - INTERVAL '30 days') AS lowest_30d_price,
  AVG(price) FILTER (WHERE captured_at >= NOW() - INTERVAL '30 days') AS avg_30d_price,
  MIN(price) FILTER (WHERE captured_at >= NOW() - INTERVAL '90 days') AS lowest_90d_price,
  AVG(price) FILTER (WHERE captured_at >= NOW() - INTERVAL '90 days') AS avg_90d_price,
  (ARRAY_AGG(price ORDER BY captured_at DESC))[1] AS latest_price,
  MAX(captured_at) AS latest_captured_at
FROM kauvio_canonical_price_history
GROUP BY canonical_product_id;
