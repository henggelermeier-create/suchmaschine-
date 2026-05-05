BEGIN;

UPDATE search_tasks
SET strategy = 'swiss_product_price_compare',
    user_visible_note = 'KI sucht echte Produkte und vergleicht Schweizer Shoppreise.',
    task_priority = GREATEST(COALESCE(task_priority, 0), 90),
    source_budget = GREATEST(COALESCE(source_budget, 0), 80),
    updated_at = NOW()
WHERE status IN ('pending','running')
  AND strategy = 'swiss_ai_live'
  AND query !~* '(gutschein|geschenkgutschein|voucher|coupon|blog|ratgeber|news|artikel|beitrag|magazin|forum|pdf|datenblatt|login|konto|warenkorb|checkout|ticket|event|abo|service)';

WITH priority_sources AS (
  SELECT id, source_key, source_kind, search_url_template, sitemap_url, base_url, priority, manual_boost
  FROM swiss_sources
  WHERE is_active = TRUE
    AND source_key IN ('toppreise','digitec','galaxus','brack','interdiscount','mediamarkt_ch','microspot','fust','melectronics','alternate_ch','mobilezone','conrad_ch','steg')
), active_tasks AS (
  SELECT id, query
  FROM search_tasks
  WHERE status IN ('pending','running')
    AND strategy = 'swiss_product_price_compare'
    AND created_at >= NOW() - INTERVAL '6 hours'
)
INSERT INTO search_task_sources(search_task_id, provider, source_kind, seed_value, status, swiss_source_id, planner_reason, source_priority, created_at, updated_at)
SELECT t.id,
       s.source_key,
       s.source_kind,
       CASE
         WHEN s.source_kind = 'comparison_search' THEN t.query
         WHEN s.search_url_template IS NOT NULL THEN replace(s.search_url_template, '{query}', replace(t.query, ' ', '%20'))
         WHEN s.sitemap_url IS NOT NULL THEN s.sitemap_url
         WHEN s.base_url IS NOT NULL THEN s.base_url
         ELSE t.query
       END,
       'pending',
       s.id,
       'Pflichtquelle für Schweizer Produkt-Preisvergleich',
       COALESCE(s.priority, 0) + COALESCE(s.manual_boost, 0) * 10 + 500,
       NOW(),
       NOW()
FROM active_tasks t
CROSS JOIN priority_sources s
ON CONFLICT (search_task_id, provider, source_kind) DO UPDATE SET
  seed_value = EXCLUDED.seed_value,
  swiss_source_id = COALESCE(search_task_sources.swiss_source_id, EXCLUDED.swiss_source_id),
  planner_reason = EXCLUDED.planner_reason,
  source_priority = GREATEST(COALESCE(search_task_sources.source_priority, 0), COALESCE(EXCLUDED.source_priority, 0)),
  status = CASE WHEN search_task_sources.status = 'failed' THEN 'pending' ELSE search_task_sources.status END,
  updated_at = NOW();

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
VALUES (
  'force_live_search_product_compare',
  'warning',
  jsonb_build_object(
    'active_product_compare_tasks', (SELECT COUNT(*) FROM search_tasks WHERE status IN ('pending','running') AND strategy = 'swiss_product_price_compare'),
    'priority_sources', (SELECT COUNT(*) FROM swiss_sources WHERE is_active = true AND source_key IN ('toppreise','digitec','galaxus','brack','interdiscount','mediamarkt_ch','microspot','fust','melectronics','alternate_ch','mobilezone','conrad_ch','steg'))
  ),
  'force_product_compare_live_search',
  NOW()
);

COMMIT;
