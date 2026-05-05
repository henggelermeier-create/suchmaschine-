CREATE TABLE IF NOT EXISTS kauvio_canonical_products (
  id BIGSERIAL PRIMARY KEY,
  canonical_key TEXT UNIQUE,
  title TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  fingerprint TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_products_brand
  ON kauvio_canonical_products (brand);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_products_category
  ON kauvio_canonical_products (category);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_products_fingerprint
  ON kauvio_canonical_products (fingerprint);

CREATE TABLE IF NOT EXISTS kauvio_canonical_product_offers (
  id BIGSERIAL PRIMARY KEY,
  canonical_product_id BIGINT NOT NULL REFERENCES kauvio_canonical_products(id) ON DELETE CASCADE,
  ingested_product_id BIGINT REFERENCES kauvio_ingested_products(id) ON DELETE SET NULL,
  product_url TEXT,
  merchant TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'CHF',
  match_score INTEGER,
  match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canonical_product_id, product_url)
);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_product_offers_canonical
  ON kauvio_canonical_product_offers (canonical_product_id);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_product_offers_url
  ON kauvio_canonical_product_offers (product_url);

CREATE INDEX IF NOT EXISTS idx_kauvio_canonical_product_offers_price
  ON kauvio_canonical_product_offers (price);

CREATE OR REPLACE FUNCTION touch_kauvio_canonical_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kauvio_canonical_products_updated_at ON kauvio_canonical_products;
CREATE TRIGGER trg_kauvio_canonical_products_updated_at
BEFORE UPDATE ON kauvio_canonical_products
FOR EACH ROW
EXECUTE FUNCTION touch_kauvio_canonical_products_updated_at();

DROP TRIGGER IF EXISTS trg_kauvio_canonical_product_offers_updated_at ON kauvio_canonical_product_offers;
CREATE TRIGGER trg_kauvio_canonical_product_offers_updated_at
BEFORE UPDATE ON kauvio_canonical_product_offers
FOR EACH ROW
EXECUTE FUNCTION touch_kauvio_canonical_products_updated_at();
