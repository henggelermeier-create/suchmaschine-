import React from 'react';
import { getKauvioFeedbackLabel } from './kauvioAiSearchClient.js';

export function KauvioFeedbackSignal({ product }) {
  const signal = product?.feedback_signal;
  const label = getKauvioFeedbackLabel(product);

  if (!signal || !label) return null;

  const tone = signal.score_delta > 0
    ? 'positive'
    : signal.score_delta < 0
      ? 'negative'
      : 'neutral';

  return (
    <div className={`kauvio-feedback-signal kauvio-feedback-signal--${tone}`} title={`${signal.total_feedback} Feedbacks berücksichtigt`}>
      <span className="kauvio-feedback-signal__label">{label}</span>
      {signal.confidence !== undefined ? (
        <span className="kauvio-feedback-signal__confidence">
          Vertrauen {Math.round(signal.confidence * 100)}%
        </span>
      ) : null}
    </div>
  );
}

export default KauvioFeedbackSignal;
