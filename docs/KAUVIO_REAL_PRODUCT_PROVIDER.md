# Kauvio Real Product Provider

PR #73 verbindet die Kauvio AI Search API mit echten Produktdaten.

## Neue Datei

```txt
webapp/server/kauvio_product_provider.mjs
```

## Ziel

Die KI-Suche soll echte Produktkandidaten aus der Datenbank laden und diese danach durch die Kauvio AI Search Runtime bewerten lassen.

```txt
Datenbankprodukte → Kauvio AI Search API → Kauvio Score → KI-Kaufberater-Antwort
```

## Unterstützte Datenquellen

Der Provider ist bewusst schema-tolerant und versucht mehrere Quellen der Reihe nach:

1. `product_search_index`
2. `canonical_products` + `product_prices`
3. `products`

Wenn eine Tabelle oder Spalte in einer Umgebung nicht existiert, wird automatisch die nächste Variante versucht.

## Verwendung

```js
import { Pool } from 'pg';
import { registerKauvioAiSearchRoutes } from './kauvio_ai_search_routes.mjs';
import { createKauvioProductProvider } from './kauvio_product_provider.mjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const productProvider = createKauvioProductProvider({ pool });

registerKauvioAiSearchRoutes(app, {
  productProvider,
  registerSearchAlias: true,
});
```

Danach verfügbar:

```txt
GET /api/kauvio/ai-search?q=guter%20Laptop%20für%20Schule%20unter%20700%20CHF
```

## Response

Die Route aus PR #72 liefert danach echte Produkte mit:

- `kauvio_score`
- `kauvio_signals`
- `ranking_reasons`
- `decision_badge`
- `advisor.top_recommendation`
- `advisor.best_deal`
- `advisor.budget_alternative`
- `advisor.premium_alternative`
- `advisor.warnings`

## Warum schema-tolerant?

Im Projekt existieren mehrere Entwicklungsstufen für Canonical Products, Product Prices, Search Index und Preis-Historie. Der Provider soll sofort nutzbar sein, ohne die Produktion durch eine zu enge Tabellenannahme zu blockieren.

## Nächster Schritt

Nach Merge von PR #73:

1. Provider in `webapp/server/index.mjs` registrieren.
2. Bestehende Produktdatenbank live testen.
3. Frontend auf `/api/kauvio/ai-search` umstellen.
4. Danach pgvector/Embeddings für echte semantische Suche aktivieren.
