import React from 'react';
import {
  formatKauvioPrice,
  getKauvioProductTitle,
  getKauvioProductUrl,
} from './kauvioAiSearchClient.js';

function ScorePill({ score }) {
  if (score === undefined || score === null) return null;
  return (
    <span className="kauvio-score-pill" aria-label={`Kauvio Score ${score} von 100`}>
      Kauvio Score {score}/100
    </span>
  );
}

function ProductLink({ product, children }) {
  const url = getKauvioProductUrl(product);
  if (!url) return <>{children}</>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="kauvio-product-link">
      {children}
    </a>
  );
}

export function KauvioProductCard({ product, variant = 'default' }) {
  if (!product) return null;

  const title = getKauvioProductTitle(product);
  const price = formatKauvioPrice(product);
  const reasons = Array.isArray(product.ranking_reasons) ? product.ranking_reasons : [];

  return (
    <article className={`kauvio-product-card kauvio-product-card--${variant}`}>
      {product.image ? (
        <img className="kauvio-product-card__image" src={product.image} alt={title} loading="lazy" />
      ) : null}

      <div className="kauvio-product-card__body">
        {product.decision_badge ? (
          <div className="kauvio-product-card__badge">{product.decision_badge}</div>
        ) : null}

        <h3 className="kauvio-product-card__title">
          <ProductLink product={product}>{title}</ProductLink>
        </h3>

        <div className="kauvio-product-card__meta">
          {price ? <strong>{price}</strong> : null}
          {product.merchant ? <span>{product.merchant}</span> : null}
          <ScorePill score={product.kauvio_score} />
        </div>

        {reasons.length ? (
          <ul className="kauvio-reasons-list">
            {reasons.slice(0, 4).map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function WarningList({ warnings = [] }) {
  if (!warnings.length) return null;
  return (
    <section className="kauvio-advisor-section kauvio-advisor-section--warning">
      <h3>Warnungen</h3>
      <ul>
        {warnings.map((warning, index) => (
          <li key={`${warning.id ?? warning.title ?? 'warning'}-${index}`}>
            <strong>{warning.title ?? 'Produkt prüfen'}:</strong> {warning.warning}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function KauvioAiAdvisor({ advisor, products = [], intent, loading = false, error = null }) {
  if (loading) {
    return (
      <section className="kauvio-ai-advisor kauvio-ai-advisor--loading" aria-live="polite">
        <h2>Kauvio KI analysiert Produkte…</h2>
        <p>Suchabsicht, Preis, Händler, Verfügbarkeit und Qualität werden bewertet.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="kauvio-ai-advisor kauvio-ai-advisor--error" role="alert">
        <h2>Kauvio KI-Suche konnte nicht geladen werden</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!advisor && !products.length) return null;

  const top = advisor?.top_recommendation ?? products[0] ?? null;
  const comparisonItems = [
    ['Bester Deal', advisor?.best_deal],
    ['Günstige Alternative', advisor?.budget_alternative],
    ['Premium-Alternative', advisor?.premium_alternative],
  ].filter(([, product]) => product && product !== top);

  return (
    <section className="kauvio-ai-advisor" aria-label="Kauvio KI-Kaufberater">
      <div className="kauvio-ai-advisor__header">
        <div>
          <p className="kauvio-eyebrow">KI-Kaufberater</p>
          <h2>{advisor?.summary ?? 'Kauvio empfiehlt die besten Produkte für deine Suche.'}</h2>
        </div>
        {intent?.budget?.max ? (
          <div className="kauvio-intent-chip">Budget bis {intent.budget.max} {intent.budget.currency ?? 'CHF'}</div>
        ) : null}
      </div>

      {top ? (
        <section className="kauvio-advisor-section">
          <h3>Beste Wahl</h3>
          <KauvioProductCard product={top} variant="hero" />
        </section>
      ) : null}

      {comparisonItems.length ? (
        <section className="kauvio-advisor-section">
          <h3>Alternativen</h3>
          <div className="kauvio-advisor-grid">
            {comparisonItems.map(([label, product]) => (
              <div key={label}>
                <p className="kauvio-comparison-label">{label}</p>
                <KauvioProductCard product={product} variant="compact" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <WarningList warnings={advisor?.warnings ?? []} />

      {products.length ? (
        <section className="kauvio-advisor-section">
          <h3>Weitere passende Treffer</h3>
          <div className="kauvio-product-list">
            {products.slice(0, 12).map((product, index) => (
              <KauvioProductCard key={product.id ?? product.url ?? `${getKauvioProductTitle(product)}-${index}`} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

export default KauvioAiAdvisor;
