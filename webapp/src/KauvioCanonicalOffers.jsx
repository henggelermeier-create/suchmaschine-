import React, { useMemo, useState } from 'react';
import { formatKauvioPrice } from './kauvioAiSearchClient.js';

function normalizeOffers(product = {}) {
  const offers = Array.isArray(product.offers) ? product.offers : [];
  const bestOffer = product.best_offer ?? offers[0] ?? null;
  const merged = bestOffer ? [bestOffer, ...offers] : offers;
  const seen = new Set();

  return merged
    .filter(Boolean)
    .filter((offer) => {
      const key = offer.url ?? offer.product_url ?? `${offer.merchant}-${offer.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const priceA = Number.parseFloat(a.price);
      const priceB = Number.parseFloat(b.price);
      if (!Number.isFinite(priceA)) return 1;
      if (!Number.isFinite(priceB)) return -1;
      return priceA - priceB;
    });
}

function formatOfferPrice(offer, fallbackCurrency = 'CHF') {
  return formatKauvioPrice({
    price: offer?.price,
    currency: offer?.currency ?? fallbackCurrency,
  });
}

function getOfferUrl(offer) {
  return offer?.url ?? offer?.product_url ?? offer?.payload?.url ?? offer?.payload?.product_url ?? null;
}

function getOfferMerchant(offer) {
  return offer?.merchant ?? offer?.shop ?? offer?.payload?.merchant ?? offer?.payload?.shop ?? 'Shop';
}

export function KauvioCanonicalOffers({ product, maxVisible = 4 }) {
  const [expanded, setExpanded] = useState(false);
  const offers = useMemo(() => normalizeOffers(product), [product]);

  if (!product?.canonical_product_id && offers.length <= 1) return null;

  const visibleOffers = expanded ? offers : offers.slice(0, maxVisible);
  const bestOffer = offers[0] ?? null;
  const offerCount = product.offer_count ?? offers.length;

  return (
    <section className="kauvio-canonical-offers" aria-label="Händlervergleich">
      <div className="kauvio-canonical-offers__header">
        <div>
          <p className="kauvio-canonical-offers__eyebrow">Preisvergleich</p>
          <h4>{offerCount} Angebote für dieses Produkt</h4>
        </div>
        {bestOffer ? (
          <div className="kauvio-canonical-offers__best">
            <span>Bestes Angebot</span>
            <strong>{formatOfferPrice(bestOffer, product.currency) ?? 'Preis prüfen'}</strong>
          </div>
        ) : null}
      </div>

      {visibleOffers.length ? (
        <div className="kauvio-offer-table" role="table" aria-label="Angebote">
          {visibleOffers.map((offer, index) => {
            const url = getOfferUrl(offer);
            const merchant = getOfferMerchant(offer);
            const price = formatOfferPrice(offer, product.currency);
            return (
              <div className="kauvio-offer-row" role="row" key={url ?? `${merchant}-${index}`}>
                <div className="kauvio-offer-row__merchant" role="cell">
                  <strong>{merchant}</strong>
                  {index === 0 ? <span>Günstigstes Angebot</span> : null}
                </div>
                <div className="kauvio-offer-row__price" role="cell">
                  {price ?? 'Preis prüfen'}
                </div>
                <div className="kauvio-offer-row__action" role="cell">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">Zum Shop</a>
                  ) : (
                    <span>Kein Link</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="kauvio-canonical-offers__empty">Noch keine Händlerangebote verfügbar.</p>
      )}

      {offers.length > maxVisible ? (
        <button
          type="button"
          className="kauvio-canonical-offers__toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Weniger Angebote anzeigen' : `Alle ${offers.length} Angebote anzeigen`}
        </button>
      ) : null}
    </section>
  );
}

export default KauvioCanonicalOffers;
