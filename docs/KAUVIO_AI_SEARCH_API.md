# Kauvio AI Search API

Diese Datei beschreibt den zweiten Umsetzungsblock für die KI-Produktsuchmaschine.

## Neuer Route-Baustein

`webapp/server/kauvio_ai_search_routes.mjs`

Er registriert eine KI-Such-API für Kauvio:

```txt
GET  /api/kauvio/ai-search?q=guter%20Laptop%20unter%20700%20CHF
POST /api/kauvio/ai-search
```

Optional kann zusätzlich ein Alias aktiviert werden:

```txt
GET  /api/search/ai
POST /api/search/ai
```

## Response-Struktur

Die API liefert nicht nur Produkte, sondern eine Kaufentscheidung:

```json
{
  "ok": true,
  "query": "guter Laptop für Schule unter 700 CHF",
  "intent": {},
  "search_plan": {},
  "advisor": {},
  "products": [],
  "meta": {
    "engine": "kauvio_ai_product_search_v1"
  }
}
```

## Einbindung in den bestehenden Server

In `webapp/server/index.mjs` oder der zentralen Express-Datei:

```js
import { registerKauvioAiSearchRoutes } from './kauvio_ai_search_routes.mjs';

registerKauvioAiSearchRoutes(app, {
  productProvider: async ({ query, intent, plan, limit }) => {
    // TODO: bestehende DB-/Crawler-/Suchlogik anschließen
    // Muss ein Array von Produktzeilen zurückgeben.
    return [];
  },
  registerSearchAlias: true,
});
```

## Erwarteter Product Provider

Der `productProvider` kann eine Funktion oder ein Objekt sein:

```js
async function productProvider({ query, intent, plan, limit }) {
  return products;
}
```

Oder:

```js
const productProvider = {
  async searchProducts({ query, intent, plan, limit }) {
    return products;
  },
};
```

## Unterstützte Produktfelder

Die API normalisiert typische Felder automatisch:

```txt
id / product_id
 title / name / product_title
price / current_price / amount
merchant / shop / shop_name / domain
url / product_url / canonical_url
image / image_url
description / summary
availability / stock_status
rating
reviews_count
return_policy
trust_score / shop_trust_score
avg_90d_price / price_avg_90d
previous_price / original_price / list_price
```

## Warum dieser Schritt wichtig ist

Der erste PR hat die KI-Runtime gebracht. Dieser Schritt macht daraus eine API, die das Frontend oder bestehende Suche direkt nutzen kann.

Ziel:

```txt
Suchanfrage → KI-Intent → Produktkandidaten → Kauvio Score → Kaufberater-Antwort
```

## Nächste Schritte

1. Bestehenden Produkt-Search-Provider anschließen.
2. `/api/kauvio/ai-search` im Frontend verwenden.
3. Suchergebnis-Seite um `advisor`, `kauvio_score`, `ranking_reasons` und `decision_badge` erweitern.
4. Danach echte Vector Search mit pgvector ergänzen.
