# Kauvio Feedback Scoring

PR #78 macht gespeichertes Nutzerfeedback für das Ranking nutzbar.

## Neue Dateien

```txt
webapp/server/kauvio_feedback_scoring.mjs
webapp/server/kauvio_feedback_scoring.test.mjs
database/migrations/041_kauvio_feedback_scoring_view.sql
```

## Ziel

Feedback soll den Kauvio Score beeinflussen:

```txt
Feedback → Scoring View → Score Delta → neues Ranking
```

## Positive Signale

```txt
fits
great_deal
```

Diese Signale erhöhen den Kauvio Score.

## Negative Signale

```txt
not_relevant
too_expensive
wrong_category
bad_shop
```

Diese Signale senken den Kauvio Score.

## Score Delta

Das Modul berechnet ein begrenztes Score Delta:

```txt
-20 bis +20 Punkte
```

Das verhindert, dass wenige Feedbacks ein Ergebnis komplett dominieren.

## Verwendung

```js
import { enrichProductsWithKauvioFeedback } from './kauvio_feedback_scoring.mjs';

const productsWithFeedback = await enrichProductsWithKauvioFeedback({
  pool,
  products,
});
```

## Ergebnis pro Produkt

```json
{
  "kauvio_score": 91,
  "feedback_signal": {
    "score_delta": 6,
    "confidence": 0.8,
    "total_feedback": 12
  },
  "ranking_reasons": [
    "Nutzerfeedback bestätigt dieses Ergebnis"
  ]
}
```

## Nächster Schritt

Nach Merge von PR #78:

1. `enrichProductsWithKauvioFeedback` nach dem Kauvio-Ranking anwenden.
2. Feedback-Signale in der API-Response anzeigen.
3. Später Gewichtung nach Kategorie und Query-Intent verfeinern.
