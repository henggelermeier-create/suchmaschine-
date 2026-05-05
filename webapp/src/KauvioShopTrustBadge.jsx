import React from 'react';

function getBadgeCopy(product = {}) {
  const level = product.shop_risk_level;
  const score = product.shop_trust_score;

  if (!level || score === undefined || score === null) return null;

  if (level === 'trusted') {
    return {
      tone: 'trusted',
      label: `Vertrauenswürdiger Shop · ${score}/100`,
    };
  }

  if (level === 'risky') {
    return {
      tone: 'risky',
      label: `Shop prüfen · ${score}/100`,
    };
  }

  return {
    tone: 'check',
    label: `Shop-Signale prüfen · ${score}/100`,
  };
}

export function KauvioShopTrustBadge({ product }) {
  const badge = getBadgeCopy(product);
  if (!badge) return null;

  const warnings = Array.isArray(product.shop_warnings) ? product.shop_warnings : [];

  return (
    <div className={`kauvio-shop-trust kauvio-shop-trust--${badge.tone}`}>
      <span className="kauvio-shop-trust__label">{badge.label}</span>
      {warnings.length ? (
        <ul className="kauvio-shop-trust__warnings">
          {warnings.slice(0, 3).map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default KauvioShopTrustBadge;
