import React, { useMemo } from 'react';

import './kauvio-ai-advisor.css';
import './kauvio-feedback.css';
import './kauvio-feedback-signal.css';
import './kauvio-shop-trust.css';
import './kauvio-canonical-offers.css';
import './kauvio-buy-timing.css';
import './kauvio-search-page.css';

import { KauvioAiAdvisor, KauvioProductCard } from './KauvioAiAdvisor.jsx';
import { KauvioFeedbackButtons } from './KauvioFeedbackButtons.jsx';
import { KauvioFeedbackSignal } from './KauvioFeedbackSignal.jsx';
import { KauvioShopTrustBadge } from './KauvioShopTrustBadge.jsx';
import { KauvioCanonicalOffers } from './KauvioCanonicalOffers.jsx';
import { KauvioBuyTimingBadge } from './KauvioBuyTimingBadge.jsx';
import { useKauvioAiSearch } from './useKauvioAiSearch.js';

function KauvioResultEnhancements({ product, query, intent, searchId, sessionId }) {
  return (
    <div className="kauvio-result-enhancements">
      <KauvioBuyTimingBadge product={product} />
      <KauvioShopTrustBadge product={product} />
      <KauvioFeedbackSignal product={product} />
      <KauvioCanonicalOffers product={product} />
      <KauvioFeedbackButtons
        product={product}
        query={query}
        intent={intent}
        searchId={searchId}
        sessionId={sessionId}
      />
    </div>
  );
}

export function KauvioSearchResult({ product, query, intent, searchId, sessionId }) {
  return (
    <article className="kauvio-search-result">
      <KauvioProductCard product={product} />
      <KauvioResultEnhancements
        product={product}
        query={query}
        intent={intent}
        searchId={searchId}
        sessionId={sessionId}
      />
    </article>
  );
}

export function KauvioSearchPage({ initialQuery = '', sessionId }) {
  const {
    query,
    setQuery,
    runSearch,
    products,
    advisor,
    intent,
    searchPlan,
    meta,
    loading,
    error,
  } = useKauvioAiSearch(initialQuery, {
    endpoint: '/api/kauvio/ai-search-price',
    fallbackEndpoints: [
      '/api/kauvio/ai-search-trust',
      '/api/kauvio/ai-search-feedback',
      '/api/kauvio/ai-search',
    ],
    limit: 24,
  });

  const searchId = useMemo(() => meta?.search_id ?? meta?.request_id ?? `${Date.now()}`, [meta]);

  function handleSubmit(event) {
    event.preventDefault();
    runSearch(query);
  }

  return (
    <main className="kauvio-search-page">
      <section className="kauvio-search-hero">
        <p className="kauvio-search-hero__eyebrow">Kauvio KI-Suchmaschine</p>
        <h1>Finde das beste Produkt, den besten Shop und den richtigen Kaufzeitpunkt.</h1>
        <p>
          Kauvio bewertet Produkte mit KI, Feedback, Shop-Trust, Preisvergleich und Preis-Historie.
        </p>

        <form className="kauvio-search-form" onSubmit={handleSubmit}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="z.B. guter Laptop für Schule unter 700 CHF"
            aria-label="Produkt suchen"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Kauvio analysiert…' : 'Suchen'}
          </button>
        </form>
      </section>

      <KauvioAiAdvisor
        advisor={advisor}
        products={products}
        intent={intent}
        loading={loading}
        error={error}
      />

      {searchPlan ? (
        <section className="kauvio-search-plan" aria-label="Kauvio Suchplan">
          <h2>KI-Suchplan</h2>
          <pre>{JSON.stringify(searchPlan, null, 2)}</pre>
        </section>
      ) : null}

      {products.length ? (
        <section className="kauvio-search-results" aria-label="Kauvio Suchresultate">
          <div className="kauvio-search-results__header">
            <h2>Alle Resultate</h2>
            {meta?.engine ? <span>{meta.engine}</span> : null}
          </div>

          <div className="kauvio-search-results__grid">
            {products.map((product, index) => (
              <KauvioSearchResult
                key={product.id ?? product.canonical_product_id ?? product.url ?? `${product.title}-${index}`}
                product={product}
                query={query}
                intent={intent}
                searchId={searchId}
                sessionId={sessionId}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default KauvioSearchPage;
