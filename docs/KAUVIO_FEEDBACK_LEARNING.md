# Kauvio Feedback Learning

PR #77 ergänzt die Grundlage, damit Kauvio aus Nutzerreaktionen lernen kann.

## Neue Backend-Dateien

```txt
webapp/server/kauvio_feedback_routes.mjs
database/migrations/040_kauvio_search_feedback.sql
```

## Neue Frontend-Dateien

```txt
webapp/src/kauvioFeedbackClient.js
webapp/src/KauvioFeedbackButtons.jsx
webapp/src/kauvio-feedback.css
```

## API

```txt
POST /api/kauvio/feedback
```

Unterstützte Feedback-Typen:

```txt
fits
not_relevant
too_expensive
wrong_category
bad_shop
great_deal
```

## Beispiel-Payload

```json
{
  "feedback_type": "fits",
  "query": "guter Laptop für Schule unter 700 CHF",
  "product_id": "123",
  "product_title": "Lenovo IdeaPad",
  "kauvio_score": 88,
  "intent": {
    "category": "laptop"
  }
}
```

## Frontend-Integration

```jsx
import './kauvio-feedback.css';
import { KauvioFeedbackButtons } from './KauvioFeedbackButtons.jsx';

<KauvioFeedbackButtons
  product={product}
  query={query}
  intent={intent}
/>
```

## Ziel

Feedback wird gespeichert und kann später genutzt werden für:

- bessere Rankings
- Erkennung falscher Kategorien
- Erkennung zu teurer Produkte
- Händler-/Shop-Vertrauenssignale
- Verbesserung des Kauvio Scores

## Nächster Schritt

Nach Merge von PR #77:

1. Feedback-Route im Server registrieren.
2. Feedback-Buttons in `KauvioProductCard` oder die bestehende Suchseite einbauen.
3. Feedback-Summary in den Kauvio Score einfließen lassen.
