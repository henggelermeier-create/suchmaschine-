BEGIN;

INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by)
VALUES (
  'autonomous_builder',
  true,
  '{"baseline_limit": 20, "trending_limit": 40, "enqueue_per_tick": 3, "target_canonical_products": 10000, "seed_batch_size": 250, "recycle_completed_after_hours": 24, "max_pending_candidates": 2000}'::jsonb,
  'Füllt den KI-Produktbestand selbständig bis zur Zielmenge auf und lernt aus Suchläufen, Trends und Canonicals.',
  'migration'
)
ON CONFLICT (control_key) DO UPDATE SET
  control_value_json = COALESCE(ai_runtime_controls.control_value_json, '{}'::jsonb) || '{"baseline_limit": 20, "trending_limit": 40, "enqueue_per_tick": 3, "target_canonical_products": 10000, "seed_batch_size": 250, "recycle_completed_after_hours": 24, "max_pending_candidates": 2000}'::jsonb,
  description = EXCLUDED.description,
  updated_at = NOW();

COMMIT;
