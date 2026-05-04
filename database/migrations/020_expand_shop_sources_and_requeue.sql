BEGIN;

-- Hotfix: keep this migration safe for production startup.
-- The previous version inserted into search_task_sources with an ON CONFLICT target
-- that can fail on databases missing the exact unique constraint. Because migrations
-- run during server boot, that made the web service unavailable.

INSERT INTO swiss_sources(source_key, display_name, provider_kind, source_kind, country_code, language_code, base_url, search_url_template, categories_json, priority, confidence_score, refresh_interval_minutes, is_active, notes, manual_boost, updated_at)
VALUES
  ('mediamarkt_ch', 'MediaMarkt Schweiz', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.mediamarkt.ch', 'https://www.mediamarkt.ch/de/search.html?query={query}', '["electronics","computing","mobile","audio","gaming","home"]'::jsonb, 86, 0.82, 180, TRUE, 'Schweizer Elektronik-Shop.', 2, NOW()),
  ('officeworld', 'Office World', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.officeworld.ch', 'https://www.officeworld.ch/de/search?q={query}', '["office","computing","electronics"]'::jsonb, 64, 0.64, 240, TRUE, 'Schweizer Office-Shop.', 1, NOW()),
  ('pcking', 'PC King', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.pcking.ch', 'https://www.pcking.ch/search?sSearch={query}', '["computing","electronics","gaming"]'::jsonb, 62, 0.62, 240, TRUE, 'Schweizer PC-Shop.', 2, NOW()),
  ('techmania', 'Techmania', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.techmania.ch', 'https://www.techmania.ch/search?sSearch={query}', '["electronics","computing","mobile","audio"]'::jsonb, 62, 0.62, 240, TRUE, 'Schweizer Technik-Shop.', 2, NOW()),
  ('nettoshop', 'nettoshop.ch', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.nettoshop.ch', 'https://www.nettoshop.ch/de/search?q={query}', '["home","appliances","electronics"]'::jsonb, 66, 0.66, 240, TRUE, 'Schweizer Haushaltsgeräte-Shop.', 1, NOW()),
  ('venova', 'Venova', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.venova.ch', 'https://www.venova.ch/de/search?sSearch={query}', '["home","appliances","garden","tools"]'::jsonb, 60, 0.60, 240, TRUE, 'Schweizer Shop für Home/Garden.', 1, NOW()),
  ('digitec_fr', 'Digitec Romandie', 'shop_source', 'shop_catalog', 'CH', 'fr', 'https://www.digitec.ch', 'https://www.digitec.ch/fr/search?q={query}', '["electronics","computing","mobile","audio","gaming"]'::jsonb, 70, 0.70, 180, TRUE, 'Französische Schweizer Digitec-Quelle.', 1, NOW()),
  ('galaxus_fr', 'Galaxus Romandie', 'shop_source', 'shop_catalog', 'CH', 'fr', 'https://www.galaxus.ch', 'https://www.galaxus.ch/fr/search?q={query}', '["electronics","home","fashion","sports","beauty","garden"]'::jsonb, 70, 0.70, 180, TRUE, 'Französische Schweizer Galaxus-Quelle.', 1, NOW()),
  ('brack_fr', 'BRACK.CH Romandie', 'shop_source', 'shop_catalog', 'CH', 'fr', 'https://www.brack.ch', 'https://www.brack.ch/fr/search?query={query}', '["electronics","computing","home","office","gaming"]'::jsonb, 66, 0.66, 180, TRUE, 'Französische Schweizer Brack-Quelle.', 1, NOW()),
  ('decathlon_ch', 'Decathlon Schweiz', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.decathlon.ch', 'https://www.decathlon.ch/de/search?Ntt={query}', '["sports","outdoor","fashion"]'::jsonb, 58, 0.58, 240, TRUE, 'Sport-Shop Schweiz.', 1, NOW())
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider_kind = EXCLUDED.provider_kind,
  source_kind = EXCLUDED.source_kind,
  country_code = EXCLUDED.country_code,
  language_code = EXCLUDED.language_code,
  base_url = EXCLUDED.base_url,
  search_url_template = EXCLUDED.search_url_template,
  categories_json = EXCLUDED.categories_json,
  priority = GREATEST(COALESCE(swiss_sources.priority, 0), EXCLUDED.priority),
  confidence_score = GREATEST(COALESCE(swiss_sources.confidence_score, 0), EXCLUDED.confidence_score),
  refresh_interval_minutes = LEAST(COALESCE(swiss_sources.refresh_interval_minutes, 9999), EXCLUDED.refresh_interval_minutes),
  is_active = TRUE,
  notes = EXCLUDED.notes,
  manual_boost = GREATEST(COALESCE(swiss_sources.manual_boost, 0), EXCLUDED.manual_boost),
  updated_at = NOW();

UPDATE search_tasks
SET status = 'pending',
    error_message = NULL,
    task_priority = GREATEST(COALESCE(task_priority, 0), 85),
    source_budget = GREATEST(COALESCE(source_budget, 0), 80),
    updated_at = NOW()
WHERE status IN ('running', 'failed')
  AND created_at >= NOW() - INTERVAL '48 hours';

UPDATE search_task_sources
SET status = 'pending',
    error_message = NULL,
    updated_at = NOW()
WHERE status IN ('running', 'failed')
  AND created_at >= NOW() - INTERVAL '48 hours';

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
VALUES (
  'hotfix_expand_shop_sources_safe',
  'warning',
  jsonb_build_object('active_sources_safe_patch', (SELECT COUNT(*) FROM swiss_sources WHERE is_active = true)),
  'hotfix_migration_020',
  NOW()
);

COMMIT;
