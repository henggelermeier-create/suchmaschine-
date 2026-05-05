# Kauvio Ingestion Worker Queue

PR #84 verbindet die KI-Ingestion mit einer Worker-/Queue-Schicht.

## Neue Dateien

```txt
database/migrations/042_kauvio_ingestion_queue.sql
webapp/server/kauvio_ingestion_queue.mjs
webapp/server/kauvio_ingestion_queue.test.mjs
```

## Ziel

Shop-URLs und Suchresultate sollen automatisiert verarbeitet werden:

```txt
Job Queue → Worker → KI-Ingestion → normalisiertes Produkt → Speicherung
```

## Tabellen

### `kauvio_ingestion_jobs`

Speichert Jobs für:

```txt
shop_url
search_results
```

Status:

```txt
pending
processing
completed
failed
```

Weitere Felder:

```txt
priority
attempts
max_attempts
locked_at
locked_by
last_error
```

### `kauvio_ingested_products`

Speichert normalisierte Produkte aus Ingestion:

```txt
title
brand
category
price
currency
merchant
url
image
description
availability
domain
raw_source
payload
first_seen_at
last_seen_at
```

## Verwendung

### Shop-URL einreihen

```js
import { enqueueShopUrl } from './kauvio_ingestion_queue.mjs';

await enqueueShopUrl(pool, 'https://shop.ch/product');
```

### Suchresultate einreihen

```js
import { enqueueSearchResults } from './kauvio_ingestion_queue.mjs';

await enqueueSearchResults(pool, [
  {
    title: 'Kaffeemaschine Angebot',
    url: 'https://shop.ch/p/1',
    price: 249,
  },
]);
```

### Worker einmal ausführen

```js
import { runKauvioIngestionWorkerOnce } from './kauvio_ingestion_queue.mjs';

await runKauvioIngestionWorkerOnce(pool);
```

## Warum

Damit Kauvio nicht nur manuell Produkte erhält, sondern automatisch Shops und Resultate in eine normalisierte Produktbasis überführen kann.

## Nächste Schritte

Nach Merge von PR #84:

1. Periodischen Worker-Prozess starten.
2. Shop-spezifische Adapter für wichtige Schweizer Händler ergänzen.
3. Deduplizierung und Canonical Product Matching ausbauen.
4. Eingelesene Produkte in die Kauvio Search Provider einbeziehen.
