# Kauvio Feedback-Aware Search API

PR #79 verbindet das Feedback-Scoring mit der Kauvio AI Search API.

## Neue Dateien

```txt
webapp/server/kauvio_feedback_aware_search_routes.mjs
webapp/server/kauvio_feedback_aware_search_routes.test.mjs
```

## Neue Route

```txt
GET  /api/kauvio/ai-search-feedback
POST /api/kauvio/ai-search-feedback
```

Optional:

```txt
GET  /api/search/ai-feedback
POST /api/search/ai-feedback
```

## Ziel

Die API führt zuerst die normale Kauvio AI Search aus und reichert die Ergebnisse danach mit Nutzerfeedback an:

```txt
KI-Ranking → Feedback-Signale → neuer Kauvio Score → neues Ranking
```

## Response-Erweiterung

```json
{
  "meta": {
    "feedback_optimized": true,
    "engine": "kauvio_ai_product_search_feedback_v1"
  },
  "advisor": {
    "feedback_optimized": true
  },
  "products": [
    {
      "kauvio_score": 91,
      "feedback_signal": {
        "score_delta": 6,
        "total_feedback": 12
      }
    }
  ]
}
```

## Verwendung

```js
import { registerKauvioFeedbackAwareSearchRoutes } from './kauvio_feedback_aware_search_routes.mjs';

registerKauvioFeedbackAwareSearchRoutes(app, {
  pool,
  productProvider,
  registerSearchAlias: true,
});
```

## Optional: Standardroute ersetzen

```js
registerKauvioFeedbackAwareSearchRoutes(app, {
  pool,
  productProvider,
  replaceAiSearch: true,
});
```

Dann wird auch `/api/kauvio/ai-search` feedback-optimiert registriert.

## Nächster Schritt

Nach Merge von PR #79:

1. Feedback-aware Route im Server aktivieren.
2. Frontend optional auf `/api/kauvio/ai-search-feedback` umstellen.
3. Feedback-Signal im Produkt-UI anzeigen.
