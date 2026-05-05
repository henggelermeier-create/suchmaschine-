BEGIN;

-- Ziel: Kauvio als beste Schweizer Produkt-KI-Suchmaschine ausbauen.
-- Mehr Schweizer Shops, klare Prioritäten, aggressive Preisaktualisierung und keine Marktplatz-Occasion-Vermischung.

INSERT INTO swiss_sources(source_key, display_name, provider_kind, source_kind, country_code, language_code, base_url, search_url_template, categories_json, priority, manual_boost, confidence_score, refresh_interval_minutes, is_active, notes)
VALUES
  ('digitec', 'Digitec', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.digitec.ch', 'https://www.digitec.ch/search?query={query}', '["electronics","computing","mobile","gaming","audio"]'::jsonb, 100, 10, 0.96, 15, TRUE, 'Pflichtquelle: Elektronik, IT, Mobile.'),
  ('galaxus', 'Galaxus', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.galaxus.ch', 'https://www.galaxus.ch/search?query={query}', '["electronics","home","garden","beauty","sports","toys"]'::jsonb, 99, 10, 0.95, 15, TRUE, 'Pflichtquelle: breites Schweizer Sortiment.'),
  ('brack', 'BRACK.CH', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.brack.ch', 'https://www.brack.ch/search?query={query}', '["electronics","computing","home","office","toys"]'::jsonb, 98, 10, 0.94, 20, TRUE, 'Pflichtquelle: Schweizer Preisvergleich.'),
  ('interdiscount', 'Interdiscount', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.interdiscount.ch', 'https://www.interdiscount.ch/de/search?q={query}', '["electronics","mobile","audio","home"]'::jsonb, 97, 10, 0.93, 20, TRUE, 'Pflichtquelle: Elektronik Schweiz.'),
  ('mediamarkt_ch', 'MediaMarkt Schweiz', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.mediamarkt.ch', 'https://www.mediamarkt.ch/de/search.html?query={query}', '["electronics","gaming","mobile","audio","home"]'::jsonb, 94, 8, 0.90, 30, TRUE, 'Wichtige Schweizer Elektronikquelle.'),
  ('microspot', 'microspot', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.microspot.ch', 'https://www.microspot.ch/de/search?query={query}', '["electronics","home","office","gaming"]'::jsonb, 93, 8, 0.90, 30, TRUE, 'Wichtige Schweizer Shopquelle.'),
  ('fust', 'Fust', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.fust.ch', 'https://www.fust.ch/de/suche.html?search={query}', '["electronics","home","appliances"]'::jsonb, 92, 7, 0.88, 30, TRUE, 'Elektro und Haushalt Schweiz.'),
  ('melectronics', 'melectronics', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.melectronics.ch', 'https://www.melectronics.ch/de/search?q={query}', '["electronics","mobile","audio","home"]'::jsonb, 88, 6, 0.84, 45, TRUE, 'Migros Elektronikquelle.'),
  ('alternate_ch', 'Alternate Schweiz', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.alternate.ch', 'https://www.alternate.ch/listing.xhtml?q={query}', '["computing","gaming","electronics"]'::jsonb, 90, 7, 0.86, 30, TRUE, 'IT und Gaming Schweiz.'),
  ('mobilezone', 'mobilezone', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.mobilezone.ch', 'https://www.mobilezone.ch/de/search?q={query}', '["mobile","electronics","audio"]'::jsonb, 86, 6, 0.84, 45, TRUE, 'Mobile, Smartphones, Zubehör.'),
  ('conrad_ch', 'Conrad Schweiz', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.conrad.ch', 'https://www.conrad.ch/de/search.html?search={query}', '["electronics","computing","tools","components"]'::jsonb, 84, 5, 0.82, 60, TRUE, 'Elektronik, Komponenten, Werkzeug.'),
  ('steg', 'STEG Electronics', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.steg-electronics.ch', 'https://www.steg-electronics.ch/de/search?q={query}', '["electronics","computing","gaming","mobile"]'::jsonb, 82, 5, 0.80, 60, TRUE, 'IT und Elektronik Schweiz.'),
  ('nettoshop', 'Nettoshop', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.nettoshop.ch', 'https://www.nettoshop.ch/search?q={query}', '["home","appliances","electronics"]'::jsonb, 80, 4, 0.78, 60, TRUE, 'Haushalt und Elektronik.'),
  ('melectronics_archive', 'Migros Online', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.migros.ch', 'https://www.migros.ch/de/search?query={query}', '["home","food","electronics","beauty"]'::jsonb, 73, 2, 0.70, 120, TRUE, 'Migros Online, falls Produkte verfügbar.'),
  ('coop_ch', 'Coop Online', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.coop.ch', 'https://www.coop.ch/de/search/?text={query}', '["home","food","beauty","electronics"]'::jsonb, 72, 2, 0.70, 120, TRUE, 'Coop Online, Produktpreise.'),
  ('apfelkiste', 'Apfelkiste', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.apfelkiste.ch', 'https://www.apfelkiste.ch/catalogsearch/result/?q={query}', '["mobile","accessories","electronics"]'::jsonb, 76, 4, 0.76, 60, TRUE, 'Schweizer Zubehör-Shop.'),
  ('pc_ostschweiz', 'PC-Ostschweiz', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.pc-ostschweiz.ch', 'https://www.pc-ostschweiz.ch/de/search.aspx?query={query}', '["computing","gaming","electronics"]'::jsonb, 78, 4, 0.76, 60, TRUE, 'IT Shop Schweiz.'),
  ('techmania', 'Techmania', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.techmania.ch', 'https://www.techmania.ch/de/search?sSearch={query}', '["electronics","computing","mobile"]'::jsonb, 74, 3, 0.72, 90, TRUE, 'Elektronik Schweiz.'),
  ('wog', 'World of Games', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.wog.ch', 'https://www.wog.ch/index.cfm/search/type/Products?query={query}', '["gaming","electronics"]'::jsonb, 74, 3, 0.72, 90, TRUE, 'Gaming Schweiz.'),
  ('exlibris', 'Ex Libris', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.exlibris.ch', 'https://www.exlibris.ch/de/suche?term={query}', '["books","gaming","electronics","media"]'::jsonb, 70, 2, 0.70, 120, TRUE, 'Medien und einzelne Produkte.'),
  ('microspot_legacy', 'microspot legacy', 'shop_source', 'shop_catalog', 'CH', 'de', 'https://www.microspot.ch', 'https://www.microspot.ch/de/suche?query={query}', '["electronics","home","office"]'::jsonb, 70, 1, 0.65, 120, FALSE, 'Fallback, nur bei Bedarf aktivieren.'),
  ('toppreise', 'Toppreise', 'comparison_source', 'comparison_search', 'CH', 'de', 'https://www.toppreise.ch', 'https://www.toppreise.ch/search?q={query}', '["comparison","electronics","home"]'::jsonb, 96, 8, 0.88, 30, TRUE, 'Vergleichsquelle als Signal, aber Kauvio muss eigene Shoppreise prüfen.'),
  ('preisvergleich_ch', 'Preisvergleich.ch', 'comparison_source', 'comparison_search', 'CH', 'de', 'https://www.preisvergleich.ch', 'https://www.preisvergleich.ch/suche/?q={query}', '["comparison"]'::jsonb, 72, 1, 0.68, 120, TRUE, 'Sekundäre Vergleichsquelle.')
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider_kind = EXCLUDED.provider_kind,
  source_kind = EXCLUDED.source_kind,
  country_code = EXCLUDED.country_code,
  language_code = EXCLUDED.language_code,
  base_url = EXCLUDED.base_url,
  search_url_template = EXCLUDED.search_url_template,
  categories_json = EXCLUDED.categories_json,
  priority = GREATEST(COALESCE(swiss_sources.priority, 0), COALESCE(EXCLUDED.priority, 0)),
  manual_boost = GREATEST(COALESCE(swiss_sources.manual_boost, 0), COALESCE(EXCLUDED.manual_boost, 0)),
  confidence_score = GREATEST(COALESCE(swiss_sources.confidence_score, 0), COALESCE(EXCLUDED.confidence_score, 0)),
  refresh_interval_minutes = LEAST(COALESCE(swiss_sources.refresh_interval_minutes, EXCLUDED.refresh_interval_minutes), EXCLUDED.refresh_interval_minutes),
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Laufende Controls: bekannte Produkte zuerst Preisrefresh, neue Produkt-Discovery kontrolliert weiter.
INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by, updated_at)
VALUES
  ('swiss_shop_discovery', TRUE, '{"enabled":true,"discover_new_ch_shops":true,"auto_activate_confidence_min":0.72,"require_product_pages":true,"avoid_blogs_news_coupons":true,"max_new_sources_per_day":50,"review_low_confidence_sources":true}'::jsonb, 'KI entdeckt laufend neue Schweizer Shops und aktiviert nur produktfähige Quellen.', 'boost_swiss_shop_coverage_quality', NOW()),
  ('price_refresh', TRUE, '{"enabled":true,"existing_products_price_only":true,"refresh_existing_after_minutes":20,"refresh_hot_products_after_minutes":10,"refresh_stale_after_hours":1,"max_refresh_jobs_per_run":800,"max_refresh_sources_per_product":40,"do_not_reimport_product_when_existing":true,"prioritize_known_products":true,"continuous_refresh":true}'::jsonb, 'Sehr aggressiver Preisrefresh für bekannte Produkte.', 'boost_swiss_shop_coverage_quality', NOW()),
  ('product_identity_guard', TRUE, '{"enabled":true,"compare_only_identical_products":true,"separate_new_refurbished_used":true,"require_model_or_ean_when_available":true,"penalize_title_mismatch":true,"hide_non_product_content":true}'::jsonb, 'Produktidentität schützen: nur identische Produkte vergleichen.', 'boost_swiss_shop_coverage_quality', NOW()),
  ('manual_shop_jobs', TRUE, '{"enabled":true,"allow_admin_manual_shop_url":true,"default_strategy":"swiss_product_price_compare","default_source_kind":"shop_catalog","queue_priority":120}'::jsonb, 'Backend/Admin kann manuelle Schweizer Shop-Jobs starten.', 'boost_swiss_shop_coverage_quality', NOW())
ON CONFLICT (control_key) DO UPDATE SET
  is_enabled = TRUE,
  control_value_json = COALESCE(ai_runtime_controls.control_value_json, '{}'::jsonb) || EXCLUDED.control_value_json,
  description = EXCLUDED.description,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- Offene Preisvergleich-Jobs mit mehr Schweizer Shops füttern.
WITH active_product_tasks AS (
  SELECT id, query
  FROM search_tasks
  WHERE status IN ('pending','running')
    AND strategy IN ('swiss_product_price_compare','price_refresh')
    AND query IS NOT NULL
  ORDER BY task_priority DESC NULLS LAST, created_at ASC
  LIMIT 300
), best_sources AS (
  SELECT id, source_key, source_kind, search_url_template, sitemap_url, base_url, priority, manual_boost
  FROM swiss_sources
  WHERE is_active = TRUE
    AND source_kind IN ('shop_catalog','comparison_search')
    AND (country_code = 'CH' OR base_url ILIKE '%.ch%')
  ORDER BY COALESCE(priority, 0) DESC, COALESCE(manual_boost, 0) DESC, display_name ASC
  LIMIT 40
)
INSERT INTO search_task_sources(search_task_id, provider, source_kind, seed_value, status, swiss_source_id, planner_reason, source_priority, created_at, updated_at)
SELECT t.id,
       s.source_key,
       s.source_kind,
       CASE
         WHEN s.search_url_template IS NOT NULL THEN replace(s.search_url_template, '{query}', replace(t.query, ' ', '%20'))
         WHEN s.sitemap_url IS NOT NULL THEN s.sitemap_url
         WHEN s.base_url IS NOT NULL THEN s.base_url
         ELSE t.query
       END,
       'pending',
       s.id,
       'Kauvio Premium: maximale Schweizer Shop-Abdeckung',
       COALESCE(s.priority, 0) + COALESCE(s.manual_boost, 0) * 12 + 300,
       NOW(),
       NOW()
FROM active_product_tasks t
CROSS JOIN best_sources s
ON CONFLICT (search_task_id, provider, source_kind) DO UPDATE SET
  seed_value = EXCLUDED.seed_value,
  planner_reason = EXCLUDED.planner_reason,
  source_priority = GREATEST(COALESCE(search_task_sources.source_priority, 0), COALESCE(EXCLUDED.source_priority, 0)),
  status = CASE WHEN search_task_sources.status IN ('failed','skipped') THEN 'pending' ELSE search_task_sources.status END,
  updated_at = NOW();

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
VALUES (
  'boost_swiss_shop_coverage_quality',
  'info',
  jsonb_build_object(
    'active_ch_sources', (SELECT COUNT(*) FROM swiss_sources WHERE is_active = TRUE AND (country_code = 'CH' OR base_url ILIKE '%.ch%')),
    'active_product_tasks', (SELECT COUNT(*) FROM search_tasks WHERE status IN ('pending','running') AND strategy IN ('swiss_product_price_compare','price_refresh')),
    'active_price_refresh_tasks', (SELECT COUNT(*) FROM search_tasks WHERE status IN ('pending','running') AND strategy = 'price_refresh')
  ),
  'boost_swiss_shop_coverage_quality',
  NOW()
);

COMMIT;
