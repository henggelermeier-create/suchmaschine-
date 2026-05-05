# Kauvio Trust UI and AI Ingestion

PR #83 verbindet die trust-aware Suche mit dem Frontend und ergänzt ein KI-Ingestion-Grundgerüst für Shops und Suchresultate.

## Frontend

Der Kauvio Frontend-Client nutzt jetzt standardmäßig:

```txt
/api/kauvio/ai-search-trust
```

Fallback-Reihenfolge:

```txt
/api/kauvio/ai-search-trust
/api/kauvio/ai-search-feedback
/api/kauvio/ai-search
```

Dadurch können Shop-Trust, Feedback-Scoring und KI-Ranking gemeinsam genutzt werden.

## Neue Ingestion-Dateien

```txt
webapp/server/kauvio_ai_ingestion.mjs
webapp/server/kauvio_ai_ingestion.test.mjs
```

## Was die Ingestion kann

### Shop-URL einlesen

```js
import { ingestShopUrl } from './kauvio_ai_ingestion.mjs';

const product = await ingestShopUrl({
  url: 'https://shop.ch/product',
  storeProduct: async (product) => {
    // Produkt speichern
  },
});
```

Die Ingestion liest:

```txt
JSON-LD Product
OpenGraph / Meta-Daten
Titel
Beschreibung
Preis
Währung
Bild
Verfügbarkeit
Domain / Händler
```

### Suchresultate einlesen

```js
import { ingestSearchResults } from './kauvio_ai_ingestion.mjs';

const products = await ingestSearchResults({
  results: [
    {
      title: 'Kaffeemaschine Angebot',
      snippet: 'Gute Kaffeemaschine unter 300 CHF',
      url: 'https://shop.ch/p/1',
      price: 249,
    },
  ],
});
```

Damit können externe oder interne Suchresultate als Produktkandidaten normalisiert werden.

## Ziel

Kauvio soll alle relevanten Schweizer Shops und Resultate einlesen können:

```txt
Shop / Suchresultat → KI-Ingestion → normalisiertes Produkt → Kauvio Ranking → beste Kaufentscheidung
```

## Grenzen dieser Stufe

Diese Stufe ist ein sicheres Grundgerüst. Sie respektiert, dass produktionsreifes Crawling zusätzlich braucht:

```txt
Robots/Rate Limits
Shop-spezifische Adapter
Duplicate-Erkennung
Queue/Retry-System
Preis-Historie
Monitoring
```

## Nächster Schritt

Nach Merge von PR #83:

1. Ingestion an Worker/Queue anschließen.
2. Shop-spezifische Adapter für wichtige Schweizer Händler ergänzen.
3. Deduplizierung und Canonical Product Matching ausbauen.
4. Trust-aware Search als Standard im UI verwenden.
