# Kauvio Canonical Price History

PR #90 ergänzt Preis-Historie pro Canonical Product.

## Neue Dateien

```txt
database/migrations/044_kauvio_canonical_price_history.sql
webapp/server/kauvio_price_history.mjs
webapp/server/kauvio_price_history.test.mjs
```

## Ziel

Kauvio soll nicht nur den günstigsten Händler anzeigen, sondern auch beantworten:

```txt
Jetzt kaufen oder lieber warten?
```

## Neue Tabelle

```txt
kauvio_canonical_price_history
```

Speichert Preis-Snapshots pro Canonical Product und Offer.

## Neue View

```txt
kauvio_canonical_price_summary
```

Berechnet pro Canonical Product:

```txt
sample_count
lowest_price
highest_price
avg_price
lowest_30d_price
avg_30d_price
lowest_90d_price
avg_90d_price
latest_price
latest_captured_at
```

## Backend-Funktionen

```js
import {
  recordKauvioCanonicalPriceSnapshot,
  recordKauvioCanonicalOfferPrices,
  loadKauvioCanonicalPriceSummary,
  calculateKauvioBuyTiming,
  enrichProductWithKauvioPriceHistory,
} from './kauvio_price_history.mjs';
```

## Kaufzeitpunkt-Signale

```txt
buy_now
wait
neutral
unknown
```

Beispiele:

```txt
buy_now: aktueller Preis liegt günstig zur Historie
wait: aktueller Preis wirkt historisch hoch
neutral: Preis liegt im normalen Bereich
unknown: zu wenig Daten
```

## Beispiel

```js
const product = await enrichProductWithKauvioPriceHistory(pool, product);

console.log(product.buy_timing.decision);
```

## Nächste Schritte

Nach Merge von PR #90:

1. Preis-Snapshots bei Ingestion automatisch speichern.
2. Preis-Historie in die Search API einbauen.
3. Frontend-Badge für Kaufzeitpunkt anzeigen.
