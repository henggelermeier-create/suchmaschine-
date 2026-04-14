#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

checks = {
    ROOT / "services/worker/worker.mjs": [
        "importFromShopCatalog",
        "looksUsefulAutonomousQuery",
        "autonomous_seed_rejected",
        "task_source_shop_catalog_result",
        "ON CONFLICT (search_task_id, provider, source_kind)",
    ],
    ROOT / "webapp/server/index.mjs": [
        "/api/admin/ai/controls/:key",
        "/api/admin/swiss-sources/:sourceKey",
        "/api/admin/search-tasks/:id/retry",
    ],
    ROOT / "services/worker/shop_catalog_import.mjs": [
        "image_url",
        "callAiExtract",
        "shop_catalog_import",
    ],
    ROOT / "database/migrations/004_worker_hotfix_schema.sql": [
        "source_priority",
        "last_enqueued_task_id",
    ],
}

failed = []
for path, needles in checks.items():
    if not path.exists():
        failed.append(f"missing file: {path}")
        continue
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            failed.append(f"missing '{needle}' in {path}")

if failed:
    print("VERIFY FAILED")
    for item in failed:
        print("-", item)
    raise SystemExit(1)

print("VERIFY OK")
