import React from 'react'
import SearchSuggestBox from './SearchSuggestBox.jsx'

const QUICK_EXAMPLES = [
  'iPhone 16 Pro 256 GB',
  'MacBook Air M4',
  'Dyson V15 Detect',
  'Sony WH-1000XM6',
  'Nintendo Switch 2',
]

const formatPrice = (value) => value != null ? `CHF ${Number(value).toFixed(2)}` : '—'

function ResultCard({ item }) {
  return (
    <a className="swiss-result-card swiss-result-card-minimal" href={`#/product/${item.slug}`}>
      <div className="swiss-result-card-head">
        <div>
          <div className="swiss-result-title">{item.title}</div>
          <div className="swiss-result-meta">
            {item.brand || 'Schweizer Vergleich'} · {item.category || 'Produkt'} · {item.offer_count || 0} Anbieter
          </div>
        </div>
        <span className="result-pill">{item.decision?.label || item.deal_label || 'KI Vergleich'}</span>
      </div>
      <div className="swiss-result-footer">
        <div>
          <strong className="price-inline">{formatPrice(item.price)}</strong>
          <div className="muted small">Bester Preis bei {item.shop_name || 'einem Shop'}</div>
        </div>
        <span className="swiss-link-arrow">→</span>
      </div>
    </a>
  )
}

export default function HomePageProfessional({
  route,
  query,
  setQuery,
  activeQuery,
  loadingProducts,
  featured,
  products,
  liveSearch,
  error,
  pollMessage,
  onSubmitSearch,
  onStartLiveSearch,
}) {
  const isSearchRoute = route === '/search'
  const title = isSearchRoute && activeQuery
    ? `Ergebnisse für „${activeQuery}”`
    : 'Beliebte Vergleiche aus der Schweiz'

  return (
    <main className="content home-content swiss-home swiss-home-minimal">
      <section className="swiss-minimal-hero">
        <div className="swiss-wordmark-wrap">
          <div className="swiss-wordmark">
            <span className="swiss-wordmark-text">KAUVIO</span>
            <span className="swiss-wordmark-dot" aria-hidden="true" />
          </div>
          <div className="swiss-wordmark-subline">AI Search Switzerland</div>
        </div>

        <h1 className="swiss-minimal-title">
          Schweizer Produkte finden.
          <br />
          Preise mit KI vergleichen.
        </h1>

        <p className="swiss-minimal-lead">
          Eine ruhige, schnelle Startseite wie bei einer Suchmaschine — aber mit Schweizer Shops,
          CHF-Preisen und Live-KI-Suche im Hintergrund.
        </p>

        <SearchSuggestBox
          query={query}
          setQuery={setQuery}
          onSubmit={onSubmitSearch}
          onAiSearch={onStartLiveSearch}
          placeholder="Produkt, Marke oder Modell eingeben"
        />

        <div className="swiss-hero-meta">
          <span className="trust-item"><span className="trust-icon">CH</span>Schweizer Fokus</span>
          <span className="trust-item"><span className="trust-icon">CHF</span>Preise in Franken</span>
          <span className="trust-item"><span className="trust-icon">AI</span>Live Discovery</span>
        </div>

        <div className="swiss-example-row">
          {QUICK_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="swiss-example-chip"
              onClick={() => {
                setQuery(example)
                onSubmitSearch?.(example)
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {liveSearch ? (
        <section className="panel swiss-section swiss-live-panel">
          <div className="section-head">
            <div>
              <h2>Live KI Suche läuft</h2>
              <p className="muted no-margin">
                {liveSearch.userVisibleNote || 'Die KI bereitet gerade neue Resultate aus Schweizer Quellen auf.'}
              </p>
            </div>
          </div>
          <div className="swiss-live-grid">
            <div className="info-card">
              <h3>Suchauftrag</h3>
              <p>{liveSearch.query || activeQuery || query || '—'}</p>
            </div>
            <div className="info-card">
              <h3>Status</h3>
              <p>{liveSearch.status || 'pending'} · {liveSearch.strategy || 'swiss_ai_live'}</p>
            </div>
            <div className="info-card">
              <h3>Backend</h3>
              <p>Open Web Discovery, Schweizer Shops und AI-Extraktion laufen parallel.</p>
            </div>
          </div>
          {pollMessage ? <p className="muted swiss-live-note">{pollMessage}</p> : null}
        </section>
      ) : null}

      {error ? (
        <section className="panel status-error">
          <p className="no-margin">{error}</p>
        </section>
      ) : null}

      <section className="panel swiss-section swiss-results-panel-minimal">
        <div className="section-head">
          <div>
            <h2>{title}</h2>
            <p className="muted no-margin">
              {isSearchRoute
                ? 'Lokale und live angereicherte Resultate aus dem aktuellen AI-Index.'
                : 'Ein schneller Überblick über vorhandene Treffer, bevor du eine Live-Suche startest.'}
            </p>
          </div>
        </div>

        {loadingProducts ? (
          <div className="empty-state">
            <h3>Resultate werden geladen</h3>
            <p>Die AI-Suche bereitet gerade aktuelle Produkte und Angebote vor.</p>
          </div>
        ) : featured.length ? (
          <div className="swiss-result-list-minimal">
            {featured.map((item) => <ResultCard item={item} key={item.slug} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Noch keine Resultate</h3>
            <p>Starte eine Suche oder direkt eine Live-KI-Suche mit einem konkreten Modell.</p>
          </div>
        )}
      </section>

      {products.length > featured.length ? (
        <section className="panel swiss-section">
          <div className="section-head">
            <div>
              <h2>Weitere Treffer</h2>
              <p className="muted no-margin">Zusätzliche Ergebnisse aus dem aktuellen Suchlauf.</p>
            </div>
          </div>
          <div className="swiss-result-list-minimal">
            {products.slice(featured.length, featured.length + 18).map((item) => (
              <ResultCard item={item} key={item.slug} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
