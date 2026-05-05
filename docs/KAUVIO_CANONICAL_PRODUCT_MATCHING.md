# Kauvio Canonical Product Matching

PR #86 ergänzt Deduplizierung und Canonical Product Matching.

## Neue Dateien

```txt
webapp/server/kauvio_canonical_matching.mjs
webapp/server/kauvio_canonical_matching_store.mjs
webapp/server/kauvio_canonical_matching.test.mjs
database/migrations/043_kauvio_canonical_product_matching.sql
```

## Ziel

Gleiche Produkte aus mehreren Shops sollen sauber zusammengeführt werden:

```txt
Shop-Angebot A
Shop-Angebot B
Shop-Angebot C
        ↓
Canonical Product
        ↓
Preisvergleich / Trust / Ranking
```

## Matching-Signale

Das Matching nutzt:

```txt
normalisierte Marke
normalisierte Kategorie
Titel-Tokens
Modellnummern
wichtige Merkmale wie GB, TB, Zoll, W, Hz
Jaccard-Ähnlichkeit
```

## Tabellen

### `kauvio_canonical_products`

Speichert das zusammengeführte Hauptprodukt.

### `kauvio_canonical_product_offers`

Speichert einzelne Shop-Angebote zu einem Canonical Product.

## Verwendung

```js
import { matchAndStoreKauvioCanonicalProduct } from './kauvio_canonical_matching_store.mjs';

await matchAndStoreKauvioCanonicalProduct(pool, product, {
  threshold: 72,
});
```

## Gruppierung ohne Datenbank

```js
import { groupProductsIntoCanonicals } from './kauvio_canonical_matching.mjs';

const groups = groupProductsIntoCanonicals(products);
```

## Warum

Ohne Canonical Matching sieht Kauvio gleiche Produkte mehrfach. Mit Canonical Matching kann Kauvio:

```txt
Preise pro Produkt vergleichen
beste Händler anzeigen
Preis-Historie korrekt führen
Dubletten entfernen
Trust pro Angebot bewerten
```

## Nächste Schritte

Nach Merge von PR #86:

1. Matching in die Ingestion Queue einbauen.
2. Eingelesene Produkte automatisch Canonicals zuordnen.
3. Preisvergleich pro Canonical Product anzeigen.
4. Canonical Products in den Kauvio Search Provider einbeziehen.
