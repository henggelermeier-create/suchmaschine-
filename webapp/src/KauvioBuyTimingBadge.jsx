import React from 'react';
import { getKauvioBuyTimingLabel } from './kauvioAiSearchClient.js';

export function KauvioBuyTimingBadge({ product }) {
  const timing = product?.buy_timing;
  const label = getKauvioBuyTimingLabel(product);

  if (!timing || !label) return null;

  const tone = timing.decision === 'buy_now'
    ? 'buy'
    : timing.decision === 'wait'
      ? 'wait'
      : 'neutral';

  return (
    <div className={`kauvio-buy-timing kauvio-buy-timing--${tone}`}>
      <strong>{label}</strong>
      {timing.reason ? <span>{timing.reason}</span> : null}
      {timing.confidence !== undefined ? (
        <small>Vertrauen {Math.round(timing.confidence * 100)}%</small>
      ) : null}
    </div>
  );
}

export default KauvioBuyTimingBadge;
