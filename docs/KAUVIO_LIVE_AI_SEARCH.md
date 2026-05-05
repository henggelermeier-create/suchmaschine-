# Kauvio Live AI Search

PR #74 aktiviert die Kauvio AI Search API für echte Produktdaten.

## Neue Datei

```txt
webapp/server/kauvio_live_ai_search.mjs
```

## Ziel

Die Route aus PR #72 und der Produkt-Provider aus PR #73 werden zu einem Live-Bootstrap verbunden:

```txt
DATABASE_URL → PostgreSQL Pool → Kauvio Product Provider → /api/kauvio/ai-search
```

## Einbindung in den Server

In `webapp/server/index.mjs` oder der zentralen Express-Datei:

```js
import {
  registerKauvioLiveAiSearch,
  installKauvioLiveAiSearchShutdownHooks,
} from './kauvio_live_ai_search.mjs';

const kauvioAiSearch = await registerKauvioLiveAiSearch(app, {
  registerSearchAlias: true,
});

installKauvioLiveAiSearchShutdownHooks(kauvioAiSearch);
```

Danach sind verfügbar:

```txt
GET  /api/kauvio/ai-search?q=guter%20Laptop%20unter%20700%20CHF
POST /api/kauvio/ai-search
GET  /api/search/ai
POST /api/search/ai
```

## Datenbank-Konfiguration

Das Modul sucht automatisch nach einer dieser Umgebungsvariablen:

```txt
DATABASE_URL
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
```

Wenn keine Datenbank-URL vorhanden ist, wird die Live-KI-Suche nicht hart fehlschlagen, sondern sauber deaktiviert.

## Pool-Konfiguration

Optionale Umgebungsvariablen:

```txt
KAUVIO_AI_SEARCH_DB_POOL_MAX=5
KAUVIO_AI_SEARCH_DB_IDLE_MS=30000
KAUVIO_AI_SEARCH_DB_CONNECT_MS=5000
```

## Erwartete Antwort

Die API liefert echte Produktdaten mit KI-Bewertung:

```json
{
  "ok": true,
  "intent": {},
  "search_plan": {},
  "advisor": {},
  "products": [
    {
      "title": "...",
      "price": 649,
      "kauvio_score": 88,
      "ranking_reasons": ["passt sehr gut zur Suchabsicht"],
      "decision_badge": "Top-Empfehlung"
    }
  ]
}
```

## Warum dieser Schritt wichtig ist

Bis PR #73 war die KI-Suche technisch vorbereitet. Mit PR #74 wird sie live aktivierbar und kann echte Produktdaten aus der Datenbank bewerten.

## Nächster Schritt

Nach Merge von PR #74:

1. In Produktion prüfen, ob `DATABASE_URL` gesetzt ist.
2. Smoke-Test ausführen:

```txt
/api/kauvio/ai-search?q=guter%20Laptop%20für%20Schule%20unter%20700%20CHF
```

3. Frontend auf die neue API umstellen.
4. Ergebnis-Seite als KI-Kaufberater umbauen.
