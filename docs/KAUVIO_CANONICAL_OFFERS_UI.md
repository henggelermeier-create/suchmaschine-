# Kauvio Canonical Offers UI

PR #89 ergänzt Frontend-Bausteine für Preisvergleich pro Canonical Product.

## Neue Dateien

```txt
webapp/src/KauvioCanonicalOffers.jsx
webapp/src/kauvio-canonical-offers.css
```

## Ziel

Wenn der Kauvio Search Provider ein Canonical Product liefert, soll das Frontend mehrere Händlerangebote sichtbar machen:

```txt
Canonical Product
  ├─ best_offer
  ├─ offers[0]
  ├─ offers[1]
  └─ offers[n]
```

## Verwendung

```jsx
import './kauvio-canonical-offers.css';
import { KauvioCanonicalOffers } from './KauvioCanonicalOffers.jsx';

<KauvioCanonicalOffers product={product} />
```

## Erwartete Produktfelder

```txt
canonical_product_id
canonical_key
offer_count
offers
best_offer
```

## UI-Funktionen

- zeigt Anzahl Angebote
- zeigt bestes Angebot prominent
- sortiert Angebote nach Preis
- zeigt Händlername, Preis und Shop-Link
- blendet viele Angebote zunächst ein
- Button zum Anzeigen aller Angebote
- responsives Layout für Mobile

## Beispiel

```jsx
<KauvioProductCard product={product} />
<KauvioCanonicalOffers product={product} />
```

## Nächste Schritte

Nach Merge von PR #89:

1. `KauvioCanonicalOffers` in die Produktkarte oder Suchseite integrieren.
2. Preis-Historie pro Canonical Product verknüpfen.
3. Händler-Trust pro Offer anzeigen.
