import React from 'react'
import {
  BadgeSwissFranc,
  Bot,
  Search,
  ShieldCheck,
  Store,
  ScanSearch,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import SearchSuggestBox from './SearchSuggestBox.jsx'
import { LogoWordmark } from './Brand.jsx'

const formatPrice = (value) => value != null ? `CHF ${Number(value).toFixed(2)}` : '—'

function dealTone(item) {
  const score = Number(item.deal_score || 0)
  if (score >= 88) return 'brand-pill brand-pill--red'
  if ((item.shop_name || '').toLowerCase().includes('digitec') || (item.shop_name || '').toLowerCase().includes('brack')) return 'brand-pill brand-pill--blue'
  return 'brand-pill brand-pill--slate'
}

function dealLabel(item) {
  if (item.decision?.label) return item.decision.label
  if (Number(item.deal_score || 0) >= 88) return 'Bestpreis'
  if (Number(item.deal_score || 0) >= 78) return 'Live AI'
  return 'Schweizer Shops'
}

function StatusChip({ icon: Icon, label, tone = 'slate' }) {
  return (
    <span className={`brand-chip brand-chip--${tone}`}>
      <Icon size={14} />
      <span>{label}</span>
    </span>
  )
}

function HomeResultCard({ item }) {
  return (
    <a className="brand-result-card" href={`#/product/${item.slug}`}>
      <div className="brand-result-card-head">
        <span className={dealTone(item)}>{dealLabel(item)}</span>
        <span className="brand-meta-inline">{item.offer_count} Shops</span>
      </div>
      <div className="brand-result-title">{item.title}</div>
      <div className="brand-result-meta">{item.brand || 'Schweizer Vergleich'} · {item.category || 'Produkt'} · {item.shop_name || 'Shop'}</div>
      <div className="brand-result-footer">
        <div>
          <strong className="brand-price">{formatPrice(item.price)}</strong>
          <div className="brand-meta-inline">Bester Preis aktuell</div>
        </div>
        <span className="brand-arrow-circle"><ArrowRight size={16} /></span>
      </div>
    </a>
  )
}

export default function HomePageProfessional({ query, setQuery, loadingProducts, featured, products, liveSearch }) {
  const title = query ? `Resultate für „${query}“` : 'Aktuelle Vergleiche für die Schweiz'

  return (
    <main className="brand-page brand-home-page">
      <section className="brand-hero-card">
        <div className="brand-hero-copy">
          <div className="brand-kicker"><Sparkles size={14} /> AI-first Preisvergleich für Schweizer Shops</div>
          <LogoWordmark />
          <h1 className="brand-hero-title">Die ruhigste Produktsuche für die Schweiz.</h1>
          <p className="brand-hero-lead">
            Klare Resultate, starke Preise und eine Oberfläche wie eine echte Suchmaschine.
            Die KI findet Angebote, liest Produktseiten aus und führt passende Produkte sauber zusammen.
          </p>

          <SearchSuggestBox
            query={query}
            setQuery={setQuery}
            href="#/search"
            placeholder="z. B. iPhone 16 Pro, Dyson V15 oder Sony WH-1000XM6"
          />

          <div className="brand-chip-row">
            <StatusChip icon={Trophy} label="Bestpreis erkannt" tone="red" />
            <StatusChip icon={Store} label="Schweizer Shops" tone="slate" />
            <StatusChip icon={Bot} label="Live AI Analyse" tone="blue" />
            <StatusChip icon={BadgeSwissFranc} label="CHF direkt sichtbar" tone="slate" />
            <StatusChip icon={ScanSearch} label="Produkt-Merge aktiv" tone="blue" />
            <StatusChip icon={ShieldCheck} label="Klare Resultate" tone="red" />
          </div>
        </div>
      </section>

      {liveSearch ? (
        <section className="brand-status-panel brand-status-panel--blue">
          <div>
            <div className="brand-status-label">Live AI Suche läuft</div>
            <div className="brand-status-text">{liveSearch.userVisibleNote || 'Die KI sammelt gerade Schweizer Quellen und bereitet Resultate auf.'}</div>
          </div>
          <div className="brand-status-metrics">
            <span className="brand-chip brand-chip--blue"><Search size={14} /> {liveSearch.status || 'pending'}</span>
            <span className="brand-chip brand-chip--slate"><Bot size={14} /> {liveSearch.strategy || 'swiss_ai_live'}</span>
          </div>
        </section>
      ) : null}

      <section className="brand-section-panel">
        <div className="brand-section-head">
          <div>
            <h2>{title}</h2>
            <p>Eine konsistente Markenwelt mit Blau für Suche, Rot für Schweiz und ruhigen Slate-Flächen.</p>
          </div>
        </div>

        {loadingProducts ? (
          <div className="brand-empty-state">
            <h3>Resultate werden geladen</h3>
            <p>Die aktuellen Preis- und Shopdaten werden vorbereitet.</p>
          </div>
        ) : featured.length ? (
          <div className="brand-result-grid">
            {featured.map((item) => <HomeResultCard item={item} key={item.slug} />)}
          </div>
        ) : (
          <div className="brand-empty-state">
            <h3>Keine passenden Resultate gefunden</h3>
            <p>Versuche Begriffe wie „iPhone“, „Galaxy“, „MacBook“ oder „Dyson“.</p>
          </div>
        )}
      </section>

      <section className="brand-section-panel">
        <div className="brand-section-head">
          <div>
            <h2>Weitere Angebote</h2>
            <p>Dasselbe Designsystem gilt über Startseite, Produktseite und Admin hinweg.</p>
          </div>
        </div>

        <div className="brand-list-grid">
          {products.map((item) => (
            <a className="brand-list-card" href={`#/product/${item.slug}`} key={item.slug}>
              <div>
                <div className="brand-list-title">{item.title}</div>
                <div className="brand-list-meta">{item.brand || '—'} · {item.category || 'Produkt'} · {item.offer_count} Shops</div>
              </div>
              <div className="brand-list-side">
                <span className={dealTone(item)}>{dealLabel(item)}</span>
                <strong className="brand-price">{formatPrice(item.price)}</strong>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="brand-footer brand-footer--home">
        <div>
          <strong>Kauvio</strong>
          <p>Dezentes Wortlogo, klare Farben und dieselbe Designsprache überall.</p>
        </div>
        <div className="brand-footer-links">
          <a href="#/impressum">Impressum</a>
          <a href="#/admin/login">Admin</a>
        </div>
      </footer>
    </main>
  )
}
