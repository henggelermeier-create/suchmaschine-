# Kauvio Swiss Shop Adapters

PR #85 ergänzt shop-spezifische Adapter für wichtige Schweizer Händler.

## Neue Dateien

```txt
webapp/server/kauvio_swiss_shop_adapters.mjs
webapp/server/kauvio_swiss_shop_adapters.test.mjs
```

## Aktualisiert

```txt
webapp/server/kauvio_ingestion_queue.mjs
```

Die Queue nutzt für bekannte Schweizer Shops automatisch den passenden Adapter.

## Unterstützte Händler-Familien

```txt
Digitec / Galaxus
Brack.ch
Microspot / Interdiscount
Melectronics / Migros
Coop
Manor
Zalando Switzerland
Jumbo
Hornbach Switzerland
Fust
```

## Adapter-Funktionen

```js
import {
  detectSwissShopAdapter,
  extractWithSwissShopAdapter,
  ingestSwissShopUrl,
  getSupportedSwissShopAdapters,
} from './kauvio_swiss_shop_adapters.mjs';
```

## Was extrahiert wird

Die Adapter nutzen mehrere Quellen:

```txt
JSON-LD Product
Meta-/OpenGraph-Daten
Embedded State wie __NEXT_DATA__ / __NUXT_DATA__
Shop-Domain
Kategorie-Hints
```

## Queue-Verhalten

Wenn `enqueueShopUrl` eine bekannte Schweizer Shop-Domain erkennt:

```txt
adapter_id wird im Job gespeichert
Priorität wird verbessert
Worker nutzt ingestSwissShopUrl statt generischer Ingestion
```

## Ziel

Kauvio soll Schweizer Shop-Seiten zuverlässiger einlesen und normalisierte Produktdaten für Suche, Preisvergleich und Shop-Trust liefern.

## Nächste Schritte

Nach Merge von PR #85:

1. Weitere Schweizer Händler ergänzen.
2. Händler-spezifische Preis-/Verfügbarkeitsfelder verfeinern.
3. Adapter-Monitoring einbauen.
4. Deduplizierung und Canonical Product Matching ausbauen.
