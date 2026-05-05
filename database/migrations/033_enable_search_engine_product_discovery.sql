BEGIN;

-- Suchmaschinen als Discovery-Schicht:
-- Google/Bing/Brave/DuckDuckGo/Swisscows finden Produktseiten und neue Schweizer Shops.
-- Preise werden danach direkt vom Shop gelesen, Suchmaschinenpreise gelten nie als Preisquelle.

CREATE TABLE IF NOT EXISTS search_engine_sources (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  provider_kind TEXT NOT NULL DEFAULT 'search_engine',
  endpoint_kind TEXT NOT NULL DEFAULT 'api_or_html',
  base_url TEXT,
  search_url_template TEXT,
  requires_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  api_key_env TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO search_engine_sources(source_key, display_name, endpoint_kind, base_url, search_url_template, requires_api_key, api_key_env, priority, is_active, notes)
VALUES
  ('google_cse', 'Google Programmable Search', 'api', 'https://www.googleapis.com', 'https://www.googleapis.com/customsearch/v1?q={query}&cx={GOOGLE_CSE_ID}&key={GOOGLE_CSE_API_KEY}', TRUE, 'GOOGLE_CSE_API_KEY,GOOGLE_CSE_ID', 100, TRUE, 'Google nur über offizielle Programmable Search API verwenden. Dient nur zur Produkt-/Shop-Discovery.'),
  ('bing_web', 'Bing Web Search', 'api', 'https://api.bing.microsoft.com', 'https://api.bing.microsoft.com/v7.0/search?q={query}&mkt=de-CH&count=20', TRUE, 'BING_SEARCH_API_KEY', 92, TRUE, 'Bing API für Schweizer Produktseiten-Discovery.'),
  ('brave_search', 'Brave Search', 'api', 'https://api.search.brave.com', 'https://api.search.brave.com/res/v1/web/search?q={query}&country=CH&search_lang=de&count=20', TRUE, 'BRAVE_SEARCH_API_KEY', 88, TRUE, 'Brave Search API als zusätzliche Discovery-Quelle.'),
  ('duckduckgo_html', 'DuckDuckGo HTML', 'html', 'https://duckduckgo.com', 'https://duckduckgo.com/html/?q={query}', FALSE, NULL, 70, TRUE, 'Fallback Discovery, keine Preise übernehmen.'),
  ('swisscows', 'Swisscows', 'html', 'https://swisscows.com', 'https://swisscows.com/de/web?query={query}', FALSE, NULL, 64, TRUE, 'Schweizer Suchmaschinen-Fallback für .ch Produktseiten.')
ON CONFLICT (source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  endpoint_kind = EXCLUDED.endpoint_kind,
  base_url = EXCLUDED.base_url,
  search_url_template = EXCLUDED.search_url_template,
  requires_api_key = EXCLUDED.requires_api_key,
  api_key_env = EXCLUDED.api_key_env,
  priority = EXCLUDED.priority,
  is_active = TRUE,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by, updated_at)
VALUES (
  'search_engine_product_discovery',
  TRUE,
  '{
    "enabled": true,
    "mode": "discovery_only",
    "never_trust_search_engine_prices": true,
    "engines": ["google_cse", "bing_web", "brave_search", "duckduckgo_html", "swisscows"],
    "country": "CH",
    "language": "de",
    "only_ch_domains_first": true,
    "prefer_queries": [
      "{query} kaufen Schweiz",
      "{query} site:.ch shop",
      "{query} Preis Schweiz",
      "{query} Digitec Galaxus Brack Interdiscount",
      "{query} online kaufen CHF"
    ],
    "reject_content_patterns": ["blog", "news", "ratgeber", "forum", "coupon", "gutschein", "pdf", "review", "testbericht"],
    "accept_product_patterns": ["/product", "/p/", "/artikel", "/shop", "sku", "ean", "CHF"],
    "create_shop_catalog_sources_from_results": true,
    "create_price_compare_tasks_from_results": true,
    "max_results_per_engine": 20,
    "max_new_shop_sources_per_run": 25,
    "max_search_engine_discovery_jobs_per_run": 80,
    "priority": 115
  }'::jsonb,
  'Suchmaschinen finden Produktseiten und neue Schweizer Shops; Preise werden immer direkt beim Shop validiert.',
  'enable_search_engine_product_discovery',
  NOW()
)
ON CONFLICT (control_key) DO UPDATE SET
  is_enabled = TRUE,
  control_value_json = COALESCE(ai_runtime_controls.control_value_json, '{}'::jsonb) || EXCLUDED.control_value_json,
  description = EXCLUDED.description,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- Open-Web Discovery stärker auf Produktseiten und .ch Shops ausrichten.
INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by, updated_at)
VALUES (
  'open_web_discovery',
  TRUE,
  '{
    "enabled": true,
    "product_only": true,
    "use_search_engines": true,
    "search_engine_discovery_enabled": true,
    "country_focus": "CH",
    "max_discovered_urls_per_task": 60,
    "max_shop_sources_from_web_per_task": 20,
    "only_use_web_for_discovery": true,
    "prices_must_be_shop_verified": true
  }'::jsonb,
  'Open-Web Discovery nutzt Suchmaschinen nur zum Finden von Produktseiten und Shops.',
  'enable_search_engine_product_discovery',
  NOW()
)
ON CONFLICT (control_key) DO UPDATE SET
  is_enabled = TRUE,
  control_value_json = COALESCE(ai_runtime_controls.control_value_json, '{}'::jsonb) || EXCLUDED.control_value_json,
  description = EXCLUDED.description,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- Aktive Produkt-Jobs bekommen einen Hinweis/Boost, dass Web-Discovery zusätzlich laufen soll.
UPDATE search_tasks
SET source_budget = GREATEST(COALESCE(source_budget, 0), 180),
    task_priority = GREATEST(COALESCE(task_priority, 0), 115),
    user_visible_note = COALESCE(user_visible_note, '') || CASE WHEN COALESCE(user_visible_note, '') LIKE '%Suchmaschinen-Discovery%' THEN '' ELSE ' Suchmaschinen-Discovery aktiv: KI findet zusätzliche Schweizer Produktseiten, Preise werden direkt beim Shop geprüft.' END,
    updated_at = NOW()
WHERE status IN ('pending','running')
  AND strategy IN ('swiss_product_price_compare','price_refresh');

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
VALUES (
  'enable_search_engine_product_discovery',
  'info',
  jsonb_build_object(
    'active_search_engines', (SELECT COUNT(*) FROM search_engine_sources WHERE is_active = TRUE),
    'active_product_tasks_boosted', (SELECT COUNT(*) FROM search_tasks WHERE status IN ('pending','running') AND strategy IN ('swiss_product_price_compare','price_refresh')),
    'mode', 'discovery_only_shop_verified_prices'
  ),
  'enable_search_engine_product_discovery',
  NOW()
);

COMMIT;
