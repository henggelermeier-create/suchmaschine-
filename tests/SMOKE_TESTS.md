# Smoke Tests

1. `GET /api/health`
2. `GET http://ai_service:3010/health`
3. Suche testen:
   - gopro hero
   - garmin fenix
   - iphone 16 pro 256 gb
4. Worker Logs prüfen:
   - `task_source_shop_catalog_result`
   - `imported` > 0
   - `canonical_merge_result.merged` > 0
5. DB prüfen:
   - `source_offers_v2` wächst
   - `canonical_products` wächst
   - `search_task_sources.imported_count` > 0
6. Admin testen:
   - Login
   - AI Control Update
   - Swiss Source Update
   - Task Retry
