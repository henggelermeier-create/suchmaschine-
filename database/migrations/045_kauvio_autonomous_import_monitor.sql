CREATE TABLE IF NOT EXISTS kauvio_autonomous_import_sources (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT UNIQUE NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  domain TEXT,
  source_type TEXT NOT NULL DEFAULT 'shop_category',
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_content_hash TEXT,
  last_product_count INTEGER NOT NULL DEFAULT 0,
  last_change_detected_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_interval_minutes INTEGER NOT NULL DEFAULT 360,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checking', 'changed', 'unchanged', 'failed')),
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kauvio_autonomous_import_sources_next
  ON kauvio_autonomous_import_sources (is_active, next_check_at, priority ASC);

CREATE INDEX IF NOT EXISTS idx_kauvio_autonomous_import_sources_domain
  ON kauvio_autonomous_import_sources (domain);

CREATE TABLE IF NOT EXISTS kauvio_autonomous_import_events (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT REFERENCES kauvio_autonomous_import_sources(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  content_hash TEXT,
  product_count INTEGER,
  job_id BIGINT REFERENCES kauvio_ingestion_jobs(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kauvio_autonomous_import_events_source_time
  ON kauvio_autonomous_import_events (source_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_kauvio_autonomous_import_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kauvio_autonomous_import_sources_updated_at ON kauvio_autonomous_import_sources;
CREATE TRIGGER trg_kauvio_autonomous_import_sources_updated_at
BEFORE UPDATE ON kauvio_autonomous_import_sources
FOR EACH ROW
EXECUTE FUNCTION touch_kauvio_autonomous_import_sources_updated_at();
