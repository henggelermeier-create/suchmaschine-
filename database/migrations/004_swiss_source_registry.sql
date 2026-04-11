BEGIN;

CREATE TABLE IF NOT EXISTS swiss_sources (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider_kind TEXT NOT NULL DEFAULT 'shop_source',
  source_kind TEXT NOT NULL DEFAULT 'shop_catalog',
  country_code TEXT NOT NULL DEFAULT 'CH',
  language_code TEXT DEFAULT 'de',
  base_url TEXT,
  search_url_template TEXT,
  sitemap_url TEXT,
  seed_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  categories_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  confidence_score NUMERIC(6,3) NOT NULL DEFAULT 0.5,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 240,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_swiss_sources_active_priority ON swiss_sources(is_active, priority DESC, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_swiss_sources_kind ON swiss_sources(provider_kind, source_kind);

ALTER TABLE search_task_sources
  ADD COLUMN IF NOT EXISTS swiss_source_id BIGINT REFERENCES swiss_sources(id) ON DELETE SET NULL;
ALTER TABLE search_task_sources
  ADD COLUMN IF NOT EXISTS planner_reason TEXT;
ALTER TABLE search_task_sources
  ADD COLUMN IF NOT EXISTS source_priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_search_task_sources_swiss_source ON search_task_sources(swiss_source_id, status, source_priority DESC);

INSERT INTO swiss_sources(source_key, display_name, provider_kind, source_kind, base_url, search_url_template, categories_json, priority, confidence_score, refresh_interval_minutes, notes)
VALUES
  ('toppreise', 'Toppreise', 'comparison_source', 'comparison_search', 'https://www.toppreise.ch', 'https://www.toppreise.ch/produktsuche?q={query}', '["electronics","home","computing","audio"]'::jsonb, 100, 0.95, 60, 'Schweizer Vergleichsquelle für schnelle Discovery und Preissignale.'),
  ('digitec', 'Digitec', 'shop_source', 'shop_catalog', 'https://www.digitec.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 95, 0.9, 120, 'Wichtige Schweizer Shopquelle. Discovery und Produktabgleich.'),
  ('galaxus', 'Galaxus', 'shop_source', 'shop_catalog', 'https://www.galaxus.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 94, 0.9, 120, 'Wichtige Schweizer Shopquelle. Discovery und Produktabgleich.'),
  ('brack', 'BRACK', 'shop_source', 'shop_catalog', 'https://www.brack.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 90, 0.88, 120, 'Schweizer Shopquelle für Technik und Haushalt.'),
  ('interdiscount', 'Interdiscount', 'shop_source', 'shop_catalog', 'https://www.interdiscount.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 88, 0.86, 120, 'Schweizer Shopquelle für Elektronik.'),
  ('fust', 'Fust', 'shop_source', 'shop_catalog', 'https://www.fust.ch', NULL, '["electronics","home","appliances"]'::jsonb, 80, 0.82, 180, 'Schweizer Shopquelle für Haushalt und Elektronik.'),
  ('mediamarkt', 'MediaMarkt Schweiz', 'shop_source', 'shop_catalog', 'https://www.mediamarkt.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 82, 0.84, 180, 'Schweizer Elektronikquelle.'),
  ('melectronics', 'melectronics', 'shop_source', 'shop_catalog', 'https://www.melectronics.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 72, 0.78, 180, 'Schweizer Shopquelle.'),
  ('microspot', 'microspot', 'shop_source', 'shop_catalog', 'https://www.microspot.ch', NULL, '["electronics","computing","audio","mobile","home"]'::jsonb, 70, 0.76, 180, 'Schweizer Shopquelle.'),
  ('nettoshop', 'nettoshop', 'shop_source', 'shop_catalog', 'https://www.nettoshop.ch', NULL, '["electronics","home","appliances"]'::jsonb, 68, 0.74, 240, 'Schweizer Shopquelle für Haushalt und Elektronik.')
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider_kind = EXCLUDED.provider_kind,
  source_kind = EXCLUDED.source_kind,
  base_url = EXCLUDED.base_url,
  search_url_template = EXCLUDED.search_url_template,
  categories_json = EXCLUDED.categories_json,
  priority = EXCLUDED.priority,
  confidence_score = EXCLUDED.confidence_score,
  refresh_interval_minutes = EXCLUDED.refresh_interval_minutes,
  notes = EXCLUDED.notes,
  updated_at = NOW();

COMMIT;
