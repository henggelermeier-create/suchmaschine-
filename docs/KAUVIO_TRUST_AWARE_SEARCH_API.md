# Kauvio Trust-Aware Search API

PR #82 verbindet Shop-Trust und Fake-Shop-Schutz direkt mit der Kauvio Search API.

## Neue Dateien

```txt
webapp/server/kauvio_trust_aware_search_routes.mjs
webapp/server/kauvio_trust_aware_search_routes.test.mjs
```

## Neue Route

```txt
GET  /api/kauvio/ai-search-trust
POST /api/kauvio/ai-search-trust
```

Optional:

```txt
GET  /api/search/ai-trust
POST /api/search/ai-trust
```

## Pipeline

```txt
Kauvio AI Search
  → Feedback Scoring
  → Shop Trust Scoring
  → neu sortierte Ergebnisse
  → Advisor-Warnungen
```

## Response-Erweiterung

```json
{
  "meta": {
    "shop_trust_optimized": true,
    "engine": "kauvio_ai_product_search_trust_v1"
  },
  "advisor": {
    "shop_trust_optimized": true,
    "warnings": []
  },
  "products": [
    {
      "shop_trust_score": 88,
      "shop_risk_level": "trusted",
      "shop_warnings": []
    }
  ]
}
```

## Verwendung

```js
import { registerKauvioTrustAwareSearchRoutes } from './kauvio_trust_aware_search_routes.mjs';

registerKauvioTrustAwareSearchRoutes(app, {
  pool,
  productProvider,
  registerSearchAlias: true,
});
```

## Optional: bestehende Routen ersetzen

```js
registerKauvioTrustAwareSearchRoutes(app, {
  pool,
  productProvider,
  replaceAiSearch: true,
  replaceFeedbackSearch: true,
});
```

## Ziel

Kauvio soll riskante Shops und Fake-Angebote im Ranking automatisch abwerten und Nutzern klare Warnungen zeigen.
