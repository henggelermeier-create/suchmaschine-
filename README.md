# Kauvio Applyable Production Finish

Dieses Paket ist zum direkten Einspielen gedacht.

## Inhalt
- Migration für Worker-/DB-Hotfix
- `shop_catalog_import.mjs`
- `scripts/apply_production_complete.py`
- `scripts/verify_production_complete.py`
- `.env.production.example`
- `tests/SMOKE_TESTS.md`

## Anwendung

```bash
python3 scripts/apply_production_complete.py .
python3 scripts/verify_production_complete.py .
docker compose down
docker compose build --no-cache worker ai_service webapp
docker compose up -d
```

Danach Smoke Tests ausführen.
