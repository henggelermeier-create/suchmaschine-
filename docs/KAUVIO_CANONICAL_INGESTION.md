# Kauvio Canonical Ingestion

PR #87 verbindet die Ingestion Queue direkt mit dem Canonical Product Matching.

## Aktualisiert

```txt
webapp/server/kauvio_ingestion_queue.mjs
```

## Neue Tests

```txt
webapp/server/kauvio_canonical_ingestion.test.mjs
```

## Ziel

Eingelesene Produkte sollen automatisch gespeichert und einem Canonical Product zugeordnet werden:

```txt
Shop-URL / Suchresultat
        ↓
Ingestion Queue
        ↓
Produkt speichern
        ↓
Canonical Matching
        ↓
Canonical Product + Offer speichern
```

## Neue Funktion

```js
import { saveAndMatchKauvioIngestedProduct } from './kauvio_ingestion_queue.mjs';

const result = await saveAndMatchKauvioIngestedProduct(pool, product);
```

## Worker-Verhalten

Bei `shop_url` Jobs:

```txt
Produkt wird eingelesen
Produkt wird in kauvio_ingested_products gespeichert
Produkt wird gegen kauvio_canonical_products gematched
Angebot wird in kauvio_canonical_product_offers gespeichert
Job speichert canonical_product_id und canonical_matched im Resultat
```

Bei `search_results` Jobs:

```txt
Alle Resultate werden normalisiert
Alle Produkte werden gespeichert
Alle Produkte werden Canonicals zugeordnet
Job speichert Anzahl Produkte und Canonicals
```

## Konfiguration

```js
await runKauvioIngestionWorkerOnce(pool, {
  canonicalThreshold: 72,
});
```

Canonical Matching kann übersprungen werden:

```js
await saveAndMatchKauvioIngestedProduct(pool, product, {
  skipCanonicalMatching: true,
});
```

## Warum

Damit Kauvio gleiche Produkte aus verschiedenen Shops automatisch zusammenführt und danach echte Preisvergleiche, Shop-Trust und Kaufempfehlungen pro Produkt liefern kann.

## Nächste Schritte

Nach Merge von PR #87:

1. Canonical Products in den Kauvio Search Provider einbeziehen.
2. Preisvergleich pro Canonical Product anzeigen.
3. Preis-Historie pro Canonical Product verknüpfen.
