import React from 'react'

const formatPrice = (value) => value != null ? `CHF ${Number(value).toFixed(2)}` : '—'

function dealLabel(score) {
  if (score >= 88) return 'Top Deal'
  if (score >= 78) return 'Starker Preis'
  return 'Live Preis'
}

function HomeResultCard({ item }) {
  return (
    <a className="swiss-result-card" href={`#/product/${item.slug}`}>
      <div className="swiss-result-card-head">
        <span className="result-pill">{item.decision?.label || dealLabel(item.deal_score ?? 0)}</span>
        <span className="muted small">{item.offer_count} Anbieter</span>
      </div>
      <div className="swiss-result-title">{item.title}</div>
      <div className="swiss-result-meta">{item.brand || 'Schweizer Shopvergleich'} · {item.category || 'Produktkategorie'}</div>
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

export default function HomePageProfessional({ query, setQuery, loadingProducts, featured, products }) {
  const title = query ? `Resultate für „${query}“` : 'Aktuelle Preisübersicht'

  return (
    <main className="content home-content swiss-home">
      <section className="panel swiss-hero">
        <div className="swiss-hero-copy">
          <div className="swiss-kicker">Schweizer Preisvergleich</div>
          <h1 className="swiss-title">Preise aus Schweizer Shops. Klar verglichen. Schnell gefunden.</h1>
          <p className="swiss-lead">
            Kauvio zeigt dir aktuelle Angebote aus Schweizer Onlineshops in einer ruhigen, professionellen Übersicht.
            Du suchst nach dem besten Preis, vergleichst Anbieter direkt in CHF und gelangst ohne Umwege zum passenden Shop.
          </p>

          <div className="search-shell swiss-search-shell">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Suche nach Produkt, Modell oder Marke – z. B. iPhone 15 Pro, MacBook Air oder Dyson"
            />
            <a className="btn hero-search-btn" href="#/search">Preise vergleichen</a>
          </div>

          <div className="swiss-badge-row">
            <span className="trust-item"><span className="trust-icon">CH</span>Fokus auf Schweizer Händler</span>
            <span className="trust-item"><span className="trust-icon">CHF</span>Preise direkt in Schweizer Franken</span>
            <span className="trust-item"><span className="trust-icon">✓</span>Klare Resultate ohne Umwege</span>
          </div>
        </div>

        <div className="swiss-hero-side">
          <div className="swiss-highlight-card">
            <div className="eyebrow">Warum Kauvio</div>
            <h2>Professionell, lokal und verständlich.</h2>
            <p>
              Die Startseite wurde für einen seriösen Schweizer Auftritt gestaltet: reduzierte Sprache, klare Prioritäten,
              starke Lesbarkeit und eine Suche, die sofort in den Produktvergleich führt.
            </p>
            <div className="swiss-proof-grid">
              <div className="swiss-proof-card">
                <strong>Schweizer Markt</strong>
                <span>Vergleiche mit Fokus auf lokale Shops und relevante Angebote.</span>
              </div>
              <div className="swiss-proof-card">
                <strong>Saubere Übersicht</strong>
                <span>Wichtige Informationen zuerst: Preis, Anbieter, Kategorie und Verfügbarkeit.</span>
              </div>
              <div className="swiss-proof-card">
                <strong>Schnelle Entscheidung</strong>
                <span>Von der Suche bis zum passenden Shop in wenigen Klicks.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel swiss-section">
        <div className="section-head">
          <div>
            <h2>{title}</h2>
            <p className="muted no-margin">Ausgewählte Ergebnisse aus dem aktuellen Datenbestand für einen schnellen ersten Überblick.</p>
          </div>
        </div>

        {loadingProducts ? (
          <div className="empty-state">
            <h3>Resultate werden geladen</h3>
            <p>Die aktuellen Preis- und Shopdaten werden vorbereitet.</p>
          </div>
        ) : featured.length ? (
          <div className="swiss-result-grid">
            {featured.map((item) => <HomeResultCard item={item} key={item.slug} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Keine passenden Resultate gefunden</h3>
            <p>Versuche Begriffe wie „iPhone“, „Samsung“, „MacBook“ oder „Staubsauger“.</p>
          </div>
        )}
      </section>

      <section className="panel swiss-section swiss-benefits-section">
        <div className="section-head">
          <div>
            <h2>Was die Startseite besser macht</h2>
            <p className="muted no-margin">Mehr Vertrauen, weniger Ablenkung und eine Sprache, die zu einem Schweizer Vergleichsdienst passt.</p>
          </div>
        </div>
        <div className="swiss-benefits-grid">
          <div className="info-card">
            <h3>Seriöser erster Eindruck</h3>
            <p>Die Oberfläche wirkt ruhiger, hochwertiger und näher an einer professionellen Schweizer Vergleichsplattform.</p>
          </div>
          <div className="info-card">
            <h3>Klarere Texte</h3>
            <p>Alle Startseitentexte wurden verständlicher formuliert und auf Nutzen, Vertrauen und Entscheidungssicherheit ausgerichtet.</p>
          </div>
          <div className="info-card">
            <h3>Stärkerer Fokus auf Suche</h3>
            <p>Die Suche steht im Zentrum und führt Besucher schneller von der ersten Frage zum konkreten Angebot.</p>
          </div>
        </div>
      </section>

      <section className="panel swiss-section">
        <div className="section-head">
          <div>
            <h2>Weitere Angebote im Überblick</h2>
            <p className="muted no-margin">Alle weiteren Treffer aus dem aktuellen Shopvergleich – kompakt, lesbar und direkt anklickbar.</p>
          </div>
        </div>
        <div className="results-list-pro swiss-results-list">
          {products.map((item) => (
            <a className="result-card-pro swiss-list-card" href={`#/product/${item.slug}`} key={item.slug}>
              <div className="result-card-copy">
                <div className="result-card-title">{item.title}</div>
                <div className="result-card-meta">{item.brand || '—'} · {item.category || 'Produkt'} · {item.offer_count} Anbieter</div>
              </div>
              <div className="result-card-side">
                <span className="result-pill">{item.decision?.label || dealLabel(item.deal_score ?? 0)}</span>
                <strong className="price-inline">{formatPrice(item.price)}</strong>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner swiss-footer-inner">
          <div>
            <strong>Kauvio</strong>
            <p className="muted no-margin">Professioneller Preisvergleich für die Schweiz mit Fokus auf Übersicht, Vertrauen und schnellen Entscheidungen.</p>
          </div>
          <div className="footer-links">
            <a href="#/impressum">Impressum</a>
            <a href="#/admin/login">Admin</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
