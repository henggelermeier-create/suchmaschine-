# Kauvio Price History Ingestion and Search

PR #91 verbindet Preis-Historie mit Ingestion und Search API.

## Aktualisiert

```txt
webapp/server/kauvio_ingestion_queue.mjs
```

## Neue Dateien

```txt
webapp/server/kauvio_price_aware_search_routes.mjs
webapp/server/kauvio_price_history_integration.test.mjs
```

## Ziel

Kauvio soll Preis-Snapshots automatisch erfassen und Suchresultate mit Kaufzeitpunkt-Signalen anreichern:

```txt
Ingestion → Canonical Matching → Preis-Snapshot → Search API → buy_timing
```

## Ingestion

Nach dem Speichern und Canonical Matching wird automatisch ein Preis-Snapshot geschrieben, sofern ein Preis vorhanden ist.

Job-Resultate enthalten zusätzlich:

```txt
price_snapshot_id
price_snapshots
```

## Neue Search API

```txt
GET  /api/kauvio/ai-search-price
POST /api/kauvio/ai-search-price
```

Optional:

```txt
GET  /api/search/ai-price
POST /api/search/ai-price
```

## Response-Erweiterung

Produkte können enthalten:

```txt
price_history_summary
buy_timing
```

`buy_timing.decision` ist eines von:

```txt
buy_now
wait
neutral
unknown
```

## Meta

```json
{
  "price_history_optimized": true,
  "engine": "kauvio_ai_product_search_price_v1"
}
```

## Nächster Schritt

Nach Merge von PR #91:

1. Frontend auf `/api/kauvio/ai-search-price` umstellen.
2. Kaufzeitpunkt-Badge anzeigen.
3. Preisverlauf-Chart ergänzen.
