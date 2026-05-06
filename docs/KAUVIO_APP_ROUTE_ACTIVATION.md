# Kauvio App Route Activation

PR #93 bindet die vollständige Kauvio-Suchseite direkt in die App ein und aktiviert die price-aware Search API serverseitig.

## Aktualisiert

```txt
webapp/src/App.jsx
webapp/server/kauvio_live_ai_search.mjs
```

## Frontend

Die bestehende Route:

```txt
#/search
```

rendert jetzt:

```jsx
<KauvioSearchPage />
```

Damit ist die vollständige Kauvio UI in der echten Suchroute aktiv:

```txt
KI-Kaufberater
Produktkarten
Feedback-Buttons
Feedback-Signale
Shop-Trust
Händlervergleich / Canonical Offers
Kaufzeitpunkt
KI-Suchplan
Engine-Meta
```

## Backend

`registerKauvioLiveAiSearch` registriert jetzt zusätzlich:

```txt
/api/kauvio/ai-search-price
```

und bei aktiviertem Alias:

```txt
/api/search/ai-price
```

## Konfiguration

Neue Option:

```js
registerKauvioLiveAiSearch(app, {
  registerPriceSearch: true,
});
```

Standard ist `true`.

## Ergebnis

Die App nutzt nun die stärkste Kauvio Pipeline:

```txt
Kauvio AI Search
  → Feedback Scoring
  → Shop Trust
  → Canonical Offers
  → Price History
  → Buy Timing
  → Full Search UI
```

## Nächste Schritte

Nach Merge von PR #93:

1. In Produktion `/api/kauvio/ai-search-price` testen.
2. Prüfen, ob die DB-Migrationen vollständig gelaufen sind.
3. Echte Produktdaten und Ingestion Worker aktivieren.
