CREATE TABLE IF NOT EXISTS kauvio_ingestion_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('shop_url', 'search_results')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kauvio_ingestion_jobs_next
  ON kauvio_ingestion_jobs (status, priority ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_kauvio_ingestion_jobs_type
  ON kauvio_ingestion_jobs (job_type);

CREATE INDEX IF NOT EXISTS idx_kauvio_ingestion_jobs_locked_at
  ON kauvio_ingestion_jobs (locked_at);

CREATE TABLE IF NOT EXISTS kauvio_ingested_products (
  id BIGSERIAL PRIMARY KEY,
  title TEXT,
  brand TEXT,
  category TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'CHF',
  merchant TEXT,
  url TEXT,
  image TEXT,
  description TEXT,
  availability TEXT,
  domain TEXT,
  raw_source TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (url)
);

CREATE INDEX IF NOT EXISTS idx_kauvio_ingested_products_domain
  ON kauvio_ingested_products (domain);

CREATE INDEX IF NOT EXISTS idx_kauvio_ingested_products_last_seen
  ON kauvio_ingested_products (last_seen_at DESC);

CREATE OR REPLACE FUNCTION touch_kauvio_ingestion_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kauvio_ingestion_jobs_updated_at ON kauvio_ingestion_jobs;
CREATE TRIGGER trg_kauvio_ingestion_jobs_updated_at
BEFORE UPDATE ON kauvio_ingestion_jobs
FOR EACH ROW
EXECUTE FUNCTION touch_kauvio_ingestion_jobs_updated_at();
