BEGIN;

WITH inventory_state AS (
  SELECT
    (SELECT COUNT(*) FROM canonical_products WHERE COALESCE(is_hidden, false) = false AND COALESCE(content_type, 'product') = 'product') AS visible_products,
    (SELECT COUNT(*) FROM search_tasks WHERE status IN ('pending', 'running') AND created_at >= NOW() - INTERVAL '2 hours') AS active_tasks
), seed_queries(query, normalized_query, priority) AS (
  VALUES
    ('iPhone 16 Pro', 'iphone 16 pro', 100),
    ('AirPods Pro', 'airpods pro', 96),
    ('Dyson V15', 'dyson v15', 92),
    ('MacBook Air', 'macbook air', 90),
    ('Samsung Galaxy S24', 'samsung galaxy s24', 88),
    ('PlayStation 5', 'playstation 5', 86),
    ('OLED TV', 'oled tv', 84),
    ('Gaming Laptop', 'gaming laptop', 82),
    ('Akku Bohrmaschine', 'akku bohrmaschine', 80),
    ('Sneaker', 'sneaker', 78)
), inserted_tasks AS (
  INSERT INTO search_tasks(query, normalized_query, trigger_type, status, strategy, user_visible_note, task_priority, source_budget, requested_by)
  SELECT
    sq.query,
    sq.normalized_query,
    'bootstrap_empty_inventory',
    'pending',
    'swiss_ai_bootstrap',
    'KI liest erste Schweizer Shopdaten ein.',
    sq.priority,
    50,
    'migration_bootstrap'
  FROM seed_queries sq, inventory_state state
  WHERE state.visible_products = 0
    AND state.active_tasks = 0
    AND NOT EXISTS (
      SELECT 1 FROM search_tasks st
      WHERE st.normalized_query = sq.normalized_query
        AND st.created_at >= NOW() - INTERVAL '24 hours'
    )
  RETURNING id, query, normalized_query
)
INSERT INTO search_task_sources(search_task_id, provider, source_kind, seed_value, status, swiss_source_id, planner_reason, source_priority)
SELECT
  it.id,
  ss.source_key,
  ss.source_kind,
  CASE
    WHEN ss.source_kind = 'comparison_search' THEN it.query
    WHEN ss.search_url_template IS NOT NULL THEN replace(ss.search_url_template, '{query}', replace(it.query, ' ', '%20'))
    WHEN ss.sitemap_url IS NOT NULL THEN ss.sitemap_url
    WHEN ss.base_url IS NOT NULL THEN ss.base_url
    ELSE it.query
  END,
  'pending',
  ss.id,
  'Bootstrap: leere Datenbank automatisch einlesen',
  COALESCE(ss.priority, 0) + COALESCE(ss.manual_boost, 0) * 10
FROM inserted_tasks it
JOIN swiss_sources ss ON ss.is_active = true;

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
SELECT
  'bootstrap_empty_inventory_tasks_created',
  'info',
  jsonb_build_object('created_tasks', COUNT(DISTINCT st.id), 'created_sources', COUNT(sts.id)),
  'migration_bootstrap',
  NOW()
FROM search_tasks st
LEFT JOIN search_task_sources sts ON sts.search_task_id = st.id
WHERE st.trigger_type = 'bootstrap_empty_inventory'
  AND st.created_at >= NOW() - INTERVAL '5 minutes';

COMMIT;
