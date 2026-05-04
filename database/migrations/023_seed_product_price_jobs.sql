BEGIN;

UPDATE swiss_sources
SET is_active = TRUE,
    updated_at = NOW()
WHERE source_key IN ('digitec','galaxus','brack','interdiscount','microspot','fust','melectronics','alternate_ch','steg','conrad_ch','mediamarkt_ch','mobilezone','toppreise');

WITH product_seeds(query, normalized_query, priority) AS (
  VALUES
    ('iPhone 16 Pro 256GB', 'iphone 16 pro 256gb', 100),
    ('Samsung Galaxy S24 Ultra', 'samsung galaxy s24 ultra', 98),
    ('Apple AirPods Pro 2', 'apple airpods pro 2', 96),
    ('Dyson V15 Detect', 'dyson v15 detect', 94),
    ('MacBook Air M3 13 Zoll', 'macbook air m3 13 zoll', 92),
    ('Lenovo ThinkPad T14', 'lenovo thinkpad t14', 90),
    ('Sony WH-1000XM5', 'sony wh 1000xm5', 88),
    ('Nintendo Switch OLED', 'nintendo switch oled', 86),
    ('PlayStation 5 Slim', 'playstation 5 slim', 86),
    ('LG OLED C4 55 Zoll', 'lg oled c4 55 zoll', 84),
    ('Ecovacs Deebot X5 Omni', 'ecovacs deebot x5 omni', 80),
    ('Garmin Forerunner 965', 'garmin forerunner 965', 78)
), inserted_tasks AS (
  INSERT INTO search_tasks(query, normalized_query, trigger_type, status, strategy, user_visible_note, task_priority, source_budget, requested_by, created_at, updated_at)
  SELECT ps.query,
         ps.normalized_query,
         'product_only_seed',
         'pending',
         'swiss_product_price_compare',
         'KI sucht echte Produkte und vergleicht Schweizer Shoppreise.',
         ps.priority,
         80,
         'product_only_seed',
         NOW(),
         NOW()
  FROM product_seeds ps
  WHERE NOT EXISTS (
    SELECT 1 FROM search_tasks st
    WHERE st.normalized_query = ps.normalized_query
      AND st.status IN ('pending','running','success')
      AND st.created_at >= NOW() - INTERVAL '24 hours'
  )
  RETURNING id, query
), active_sources AS (
  SELECT id, source_key, source_kind, search_url_template, sitemap_url, base_url, priority, manual_boost
  FROM swiss_sources
  WHERE is_active = TRUE
    AND source_key IN ('digitec','galaxus','brack','interdiscount','microspot','fust','melectronics','alternate_ch','steg','conrad_ch','mediamarkt_ch','mobilezone','toppreise')
)
INSERT INTO search_task_sources(search_task_id, provider, source_kind, seed_value, status, swiss_source_id, planner_reason, source_priority, created_at, updated_at)
SELECT it.id,
       src.source_key,
       src.source_kind,
       CASE
         WHEN src.source_kind = 'comparison_search' THEN it.query
         WHEN src.search_url_template IS NOT NULL THEN replace(src.search_url_template, '{query}', replace(it.query, ' ', '%20'))
         WHEN src.sitemap_url IS NOT NULL THEN src.sitemap_url
         WHEN src.base_url IS NOT NULL THEN src.base_url
         ELSE it.query
       END,
       'pending',
       src.id,
       'Produkt-only Schweizer Preisvergleich',
       COALESCE(src.priority, 0) + COALESCE(src.manual_boost, 0) * 10,
       NOW(),
       NOW()
FROM inserted_tasks it
CROSS JOIN active_sources src
WHERE NOT EXISTS (
  SELECT 1 FROM search_task_sources existing
  WHERE existing.search_task_id = it.id
    AND existing.provider = src.source_key
);

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
VALUES (
  'seed_product_price_jobs',
  'info',
  jsonb_build_object(
    'active_product_jobs', (SELECT COUNT(*) FROM search_tasks WHERE status IN ('pending','running') AND trigger_type = 'product_only_seed'),
    'active_sources', (SELECT COUNT(*) FROM swiss_sources WHERE is_active = true)
  ),
  'product_only_seed',
  NOW()
);

COMMIT;
