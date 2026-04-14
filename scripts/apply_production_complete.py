#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

worker_path = ROOT / "services" / "worker" / "worker.mjs"
index_path = ROOT / "webapp" / "server" / "index.mjs"
migration_path = ROOT / "database" / "migrations" / "004_worker_hotfix_schema.sql"
shop_catalog_path = ROOT / "services" / "worker" / "shop_catalog_import.mjs"

if not worker_path.exists():
    raise SystemExit(f"worker not found: {worker_path}")
if not index_path.exists():
    raise SystemExit(f"index not found: {index_path}")

migration_sql = (Path(__file__).resolve().parents[1] / "database" / "migrations" / "004_worker_hotfix_schema.sql").read_text(encoding="utf-8")
shop_catalog_js = (Path(__file__).resolve().parents[1] / "services" / "worker" / "shop_catalog_import.mjs").read_text(encoding="utf-8")

migration_path.write_text(migration_sql, encoding="utf-8")
shop_catalog_path.write_text(shop_catalog_js, encoding="utf-8")

worker = worker_path.read_text(encoding="utf-8")
index = index_path.read_text(encoding="utf-8")

if "import { importFromShopCatalog } from './shop_catalog_import.mjs'" not in worker:
    needle = "import { runOpenWebDiscovery } from './open_web_discovery.mjs'\n"
    replacement = needle + "import { importFromShopCatalog } from './shop_catalog_import.mjs'\n"
    if needle not in worker:
        raise SystemExit("worker import needle not found")
    worker = worker.replace(needle, replacement, 1)

if "function looksUsefulAutonomousQuery" not in worker:
    anchor = "const titleFromHostname = (hostname = '') => String(hostname || '').replace(/\\.(ch|com|net|shop)$/i, '').split(/[.-]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || hostname\n"
    insert = anchor + """function looksUsefulAutonomousQuery(input = '') { const raw = String(input || '').trim(); const normalized = normalizeSearchText(raw); if (!normalized) return false; if (normalized.length < 4) return false; const tokens = normalized.split(' ').filter(Boolean); if (!tokens.length) return false; if (tokens.every(token => token.length <= 2)) return false; if (tokens.length === 1 && tokens[0].length < 5) return false; return true }\n"""
    if anchor not in worker:
        raise SystemExit("worker quality anchor not found")
    worker = worker.replace(anchor, insert, 1)

old_insert = "for (const item of finalSelection) await pool.query(`INSERT INTO search_task_sources(search_task_id, provider, source_kind, seed_value, status, swiss_source_id, planner_reason, source_priority) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)`, [task.id, item.source.source_key, item.source.source_kind, buildSeedValue(item.source, query), item.source.id, item.reason, item.score]).catch(() => {});"
new_insert = """const dedupedSelection = []; const seenSourceKeys = new Set(); for (const item of finalSelection) { const key = `${task.id}:${item.source.source_key}:${item.source.source_kind}`; if (seenSourceKeys.has(key)) continue; seenSourceKeys.add(key); dedupedSelection.push(item) } for (const item of dedupedSelection) await pool.query(`INSERT INTO search_task_sources(search_task_id, provider, source_kind, seed_value, status, swiss_source_id, planner_reason, source_priority) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7) ON CONFLICT (search_task_id, provider, source_kind) DO UPDATE SET seed_value = EXCLUDED.seed_value, swiss_source_id = COALESCE(search_task_sources.swiss_source_id, EXCLUDED.swiss_source_id), planner_reason = EXCLUDED.planner_reason, source_priority = GREATEST(COALESCE(search_task_sources.source_priority, 0), COALESCE(EXCLUDED.source_priority, 0)), updated_at = NOW()`, [task.id, item.source.source_key, item.source.source_kind, buildSeedValue(item.source, query), item.source.id, item.reason, Number.isFinite(Number(item.score)) ? Number(item.score) : 0]).catch(() => {});"""
if old_insert in worker and "dedupedSelection" not in worker:
    worker = worker.replace(old_insert, new_insert, 1)

old_seed = "async function processAutonomousSeedCandidate(seed) { const task = await createSearchTask(seed.query, 'worker_autonomous', 'autonomous_seed'); await pool.query(`UPDATE ai_seed_candidates SET status = CASE WHEN $2 IS NULL THEN 'failed' ELSE 'completed' END, last_enqueued_task_id = $2, updated_at = NOW() WHERE id = $1`, [seed.id, task?.id || null]).catch(() => {}); workerLog('autonomous_seed_processed', { seedId: seed.id, query: seed.query, taskId: task?.id || null, result: task ? 'enqueued' : 'failed' }) }"
new_seed = """async function processAutonomousSeedCandidate(seed) { if (!looksUsefulAutonomousQuery(seed.query)) { await pool.query(`UPDATE ai_seed_candidates SET status = 'failed', notes = COALESCE(notes, '') || ' | rejected_low_quality_seed', updated_at = NOW() WHERE id = $1`, [seed.id]).catch(() => {}); workerLog('autonomous_seed_rejected', { seedId: seed.id, query: seed.query }); return } const task = await createSearchTask(seed.query, 'worker_autonomous', 'autonomous_seed'); await pool.query(`UPDATE ai_seed_candidates SET status = CASE WHEN $2::bigint IS NULL THEN 'failed' ELSE 'completed' END, last_enqueued_task_id = $2::bigint, updated_at = NOW() WHERE id = $1`, [seed.id, task?.id || null]).catch(() => {}); workerLog('autonomous_seed_processed', { seedId: seed.id, query: seed.query, taskId: task?.id || null, result: task ? 'enqueued' : 'failed' }) }"""
if old_seed in worker and "autonomous_seed_rejected" not in worker:
    worker = worker.replace(old_seed, new_seed, 1)

anchor = "async function processTaskSource(task, source) { const swissSource = await loadSwissSource(source.swiss_source_id); workerLog('task_source_start', { taskId: task.id, query: task.query, provider: source.provider, sourceKind: source.source_kind });"
if anchor in worker and "task_source_shop_catalog_result" not in worker:
    replacement = anchor + """ if (source.source_kind === 'shop_catalog') { const result = await importFromShopCatalog({ task, source, swissSource, fetchText, storeSourceOffers, canonicalModelKey, brandFromTitle, sanitizeSourceKey, logImportDiagnostic }); await pool.query(`UPDATE search_task_sources SET status = CASE WHEN $2 > 0 THEN 'success' ELSE 'failed' END, discovered_count = $3, imported_count = $2, updated_at = NOW(), error_message = CASE WHEN $2 > 0 THEN NULL ELSE 'Shop-Katalog lieferte keine speicherbaren Offers.' END WHERE id = $1`, [source.id, result.imported, result.discovered]).catch(() => {}); workerLog('task_source_shop_catalog_result', { taskId: task.id, provider: source.provider, discovered: result.discovered, imported: result.imported }); return result }"""
    worker = worker.replace(anchor, replacement, 1)

if "app.put('/api/admin/ai/controls/:key'" not in index:
    admin_anchor = "app.get('/api/admin/ai/controls', auth, async (_req, res) => res.json({ items: await getAiControls() }))\napp.get('/api/admin/swiss-sources', auth, async (_req, res) => res.json({ items: await getSwissSourcesAdmin() }))\n"
    admin_block = admin_anchor + """
app.put('/api/admin/ai/controls/:key', auth, async (req, res) => {
  const controlKey = String(req.params.key || '').trim()
  if (!controlKey) return res.status(400).json({ error: 'Ungültiger Control Key.' })
  const isEnabled = typeof req.body?.is_enabled === 'boolean' ? req.body.is_enabled : true
  const controlValueJson = normalizeJsonInput(req.body?.control_value_json, {})
  const description = String(req.body?.description || '').trim() || null
  const result = await pool.query(
    `UPDATE ai_runtime_controls
     SET is_enabled = $2,
         control_value_json = $3,
         description = COALESCE($4, description),
         updated_by = $5,
         updated_at = NOW()
     WHERE control_key = $1
     RETURNING control_key, is_enabled, control_value_json, description, updated_by, updated_at`,
    [controlKey, isEnabled, JSON.stringify(controlValueJson), description, req.user?.email || 'admin']
  ).catch(() => ({ rows: [] }))
  if (!result.rows.length) return res.status(404).json({ error: 'Control nicht gefunden.' })
  await logAiRuntimeEvent('admin_update_ai_control', controlKey, 'info', { controlKey, isEnabled, controlValueJson }, req.user?.email || 'admin')
  res.json({ ok: true, item: result.rows[0] })
})

app.put('/api/admin/swiss-sources/:sourceKey', auth, async (req, res) => {
  const sourceKey = String(req.params.sourceKey || '').trim()
  if (!sourceKey) return res.status(400).json({ error: 'Ungültiger Source Key.' })
  const priority = Number(req.body?.priority ?? 0)
  const manualBoost = Number(req.body?.manual_boost ?? 0)
  const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : true
  const notes = String(req.body?.notes || '').trim() || null
  const result = await pool.query(
    `UPDATE swiss_sources
     SET priority = $2,
         manual_boost = $3,
         is_active = $4,
         notes = COALESCE($5, notes),
         updated_at = NOW()
     WHERE source_key = $1
     RETURNING source_key, display_name, priority, manual_boost, is_active, notes, updated_at`,
    [sourceKey, priority, manualBoost, isActive, notes]
  ).catch(() => ({ rows: [] }))
  if (!result.rows.length) return res.status(404).json({ error: 'Quelle nicht gefunden.' })
  await logAiRuntimeEvent('admin_update_swiss_source', sourceKey, 'info', { sourceKey, priority, manualBoost, isActive }, req.user?.email || 'admin')
  res.json({ ok: true, item: result.rows[0] })
})

app.post('/api/admin/search-tasks/:id/retry', auth, async (req, res) => {
  const taskId = Number(req.params.id)
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Ungültige Task ID.' })
  const original = await pool.query(`SELECT query FROM search_tasks WHERE id = $1 LIMIT 1`, [taskId]).catch(() => ({ rows: [] }))
  if (!original.rows.length) return res.status(404).json({ error: 'Task nicht gefunden.' })
  const task = await enqueueLiveSearchTask(pool, original.rows[0].query, req.user?.email || 'admin_retry').catch(() => null)
  if (!task) return res.status(500).json({ error: 'Retry konnte nicht erstellt werden.' })
  await logAiRuntimeEvent('admin_retry_task', null, 'info', { originalTaskId: taskId, newTaskId: task.id, query: task.query }, req.user?.email || 'admin')
  res.json({ ok: true, task: publicTaskShape(task) })
})
"""
    if admin_anchor not in index:
        raise SystemExit("admin anchor not found")
    index = index.replace(admin_anchor, admin_block, 1)

worker_path.write_text(worker, encoding="utf-8")
index_path.write_text(index, encoding="utf-8")

print("Applied production patch:")
print("-", worker_path)
print("-", index_path)
print("-", migration_path)
print("-", shop_catalog_path)
