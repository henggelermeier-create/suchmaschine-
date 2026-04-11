BEGIN;

CREATE TABLE IF NOT EXISTS ai_seed_candidates (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  seed_source TEXT NOT NULL DEFAULT 'system',
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending',
  last_enqueued_task_id BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_seed_candidates_normalized_query
  ON ai_seed_candidates(normalized_query);
CREATE INDEX IF NOT EXISTS idx_ai_seed_candidates_status_priority
  ON ai_seed_candidates(status, priority DESC, updated_at ASC);

INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by)
VALUES (
  'autonomous_builder',
  true,
  '{"baseline_limit": 12, "trending_limit": 20, "enqueue_per_tick": 1}'::jsonb,
  'Erzeugt selbständig Seed-Suchanfragen für häufige, wichtige und trendige Schweizer Produkte.',
  'migration'
)
ON CONFLICT (control_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  control_value_json = EXCLUDED.control_value_json,
  description = EXCLUDED.description,
  updated_at = NOW();

COMMIT;
