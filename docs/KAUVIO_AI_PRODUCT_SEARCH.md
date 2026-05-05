# Kauvio AI Product Search Runtime

Diese Runtime ist der erste technische Kern für Kauvio.ch als KI-gesteuerte Produkt-Suchmaschine.

## Ziel

Kauvio soll nicht nur Produkte anzeigen, sondern die beste Kaufentscheidung erklären:

```txt
Suchen → Verstehen → Vergleichen → Bewerten → Empfehlen → Sparen
```

## Enthaltene Funktionen

Die Datei `webapp/server/kauvio_ai_product_search.mjs` liefert:

- KI-nahe Intent-Erkennung für deutsche Schweizer Produktanfragen
- Budget-Erkennung, z. B. `unter 700 CHF`
- Kategorie-Erkennung, z. B. Laptop, Schuhe, Smartphone, TV
- Use-Case-Erkennung, z. B. Schule, Arbeit, Gaming, Komfort
- Hybrid-Search-Plan aus Keyword Search, Vector Search und AI Reranking
- Kauvio Score pro Produkt
- Ranking-Gründe pro Produkt
- KI-Kaufberater-Antwort mit Top-Empfehlung, Deal, Budget-Alternative, Premium-Alternative und Warnungen

## Beispiel

```js
import { rankProductsForKauvio } from './kauvio_ai_product_search.mjs';

const result = rankProductsForKauvio('guter Laptop für Schule unter 700 CHF', products);

console.log(result.intent);
console.log(result.advisor.summary);
console.log(result.products[0].ranking_reasons);
```

## Kauvio Score

Der Score kombiniert aktuell diese Signale:

```txt
Relevance      24 %
Budget Fit     18 %
Deal Score     18 %
Trust Score    16 %
Availability   12 %
Quality        12 %
```

## Warum das wichtig ist

Normale Suchmaschinen sortieren stark nach Texttreffern. Kauvio soll nach Kaufentscheidung sortieren:

- Passt das Produkt wirklich zur Absicht?
- Ist es im Budget?
- Ist der Preis aktuell gut?
- Ist der Händler vertrauenswürdig?
- Ist das Produkt lieferbar?
- Gibt es Warnsignale?

## Nächste Integrationsschritte

1. Runtime in den bestehenden Search-Endpunkt einbinden.
2. Produktdaten aus DB/Crawler an `rankProductsForKauvio` übergeben.
3. `intent`, `kauvio_score`, `ranking_reasons` und `advisor` im API-Response zurückgeben.
4. Frontend-Ergebnisseite als KI-Kaufberater umbauen.
5. Produkt-Embeddings mit pgvector ergänzen.
6. Nutzerfeedback speichern und später in den Score einbeziehen.

## Definition of Done für diese erste Stufe

- Jede Suche erzeugt einen strukturierten Intent.
- Produkte werden mit Kauvio Score bewertet.
- Suchergebnisse enthalten Ranking-Gründe.
- Die API kann eine Top-Empfehlung und Alternativen liefern.
- Tests dokumentieren die wichtigsten Fälle.
