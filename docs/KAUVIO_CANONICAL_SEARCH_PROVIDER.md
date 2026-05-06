# Kauvio Canonical Search Provider

PR #88 bezieht Canonical Products direkt in den Kauvio Product Provider ein.

## Aktualisiert

```txt
webapp/server/kauvio_product_provider.mjs
```

## Neue Tests

```txt
webapp/server/kauvio_canonical_product_provider.test.mjs
```

## Ziel

Die Kauvio Suche soll bevorzugt mit zusammengeführten Canonical Products arbeiten:

```txt
Canonical Product
  ├─ Angebot Shop A
  ├─ Angebot Shop B
  └─ Angebot Shop C
        ↓
Kauvio Search Provider
        ↓
KI-Ranking / Preisvergleich / Shop Trust
```

## Neue bevorzugte Datenquelle

Der Product Provider versucht jetzt zuerst:

```txt
kauvio_canonical_products
kauvio_canonical_product_offers
```

Danach bleiben die bisherigen Fallbacks aktiv:

```txt
product_search_index
canonical_products + product_prices
products
```

## Response-Felder

Canonical Treffer enthalten zusätzlich:

```txt
canonical_product_id
canonical_key
offer_count
offers
best_offer
```

## Warum

Damit Kauvio keine Dubletten mehr als getrennte Suchtreffer behandeln muss und direkt pro Produkt mehrere Angebote vergleichen kann.

## Nächste Schritte

Nach Merge von PR #88:

1. Frontend Preisvergleich pro Canonical Product anzeigen.
2. `best_offer` prominent darstellen.
3. `offers` als Händlervergleich anzeigen.
4. Preis-Historie pro Canonical Product verknüpfen.
