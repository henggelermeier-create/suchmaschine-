BEGIN;

ALTER TABLE swiss_sources
  ADD COLUMN IF NOT EXISTS shop_domain TEXT;
ALTER TABLE swiss_sources
  ADD COLUMN IF NOT EXISTS auto_discovered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE swiss_sources
  ADD COLUMN IF NOT EXISTS discovery_source_key TEXT;
ALTER TABLE swiss_sources
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_swiss_sources_shop_domain
  ON swiss_sources(shop_domain)
  WHERE shop_domain IS NOT NULL;

INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by)
VALUES (
  'auto_shop_discovery',
  true,
  '{"min_priority": 38, "default_confidence": 0.46, "small_shop_boost": 1.15}'::jsonb,
  'Erkennt neue Schweizer Shop-Domains automatisch und legt sie als aktive Quellen an.',
  'migration'
)
ON CONFLICT (control_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  control_value_json = EXCLUDED.control_value_json,
  description = EXCLUDED.description,
  updated_at = NOW();

COMMIT;
