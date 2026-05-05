# Kauvio Shop Trust Protection

PR #81 ergänzt Shop-Vertrauensscore und Fake-Shop-Schutz für Kauvio.

## Neue Dateien

```txt
webapp/server/kauvio_shop_trust.mjs
webapp/server/kauvio_shop_trust.test.mjs
webapp/src/KauvioShopTrustBadge.jsx
webapp/src/kauvio-shop-trust.css
```

## Ziel

Kauvio soll nicht nur das günstigste Produkt zeigen, sondern auch vor riskanten Shops und verdächtigen Angeboten schützen.

```txt
Produktdaten → Shop Trust Score → Risiko-Level → Kauvio Score Anpassung → Warnung im UI
```

## Bewertete Signale

Positive Signale:

```txt
.ch-Domain
Schweizer Händler-Hinweis
HTTPS
Rückgabehinweis
Garantiehinweis
gute Bewertungen
ausreichend viele Reviews
```

Negative Signale:

```txt
verdächtige Domain-Muster
fehlender Händlername
unrealistisch niedriger Preis
Bad-Shop-Feedback
niedriger vorhandener Trust Score
```

## Risiko-Level

```txt
trusted
check
risky
```

## Score-Auswirkung

```txt
trusted: +4 Kauvio Score
check:   -4 Kauvio Score
risky:  -12 Kauvio Score
```

## Frontend

```jsx
import './kauvio-shop-trust.css';
import { KauvioShopTrustBadge } from './KauvioShopTrustBadge.jsx';

<KauvioShopTrustBadge product={product} />
```

## Nächster Schritt

Nach Merge von PR #81:

1. `applyKauvioShopTrustToProducts` in die Kauvio Search API einbauen.
2. Badge in Produktkarten anzeigen.
3. Trust-Signale mit realen Shop-Daten anreichern.
