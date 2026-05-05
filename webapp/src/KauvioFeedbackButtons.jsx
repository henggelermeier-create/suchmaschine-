import React, { useState } from 'react';
import {
  KAUVIO_FEEDBACK_TYPES,
  buildProductFeedbackPayload,
  sendKauvioFeedback,
} from './kauvioFeedbackClient.js';

const FEEDBACK_BUTTONS = [
  { type: KAUVIO_FEEDBACK_TYPES.fits, label: '👍 passt' },
  { type: KAUVIO_FEEDBACK_TYPES.notRelevant, label: '👎 passt nicht' },
  { type: KAUVIO_FEEDBACK_TYPES.tooExpensive, label: '💸 zu teuer' },
  { type: KAUVIO_FEEDBACK_TYPES.wrongCategory, label: '🔎 falsche Kategorie' },
  { type: KAUVIO_FEEDBACK_TYPES.badShop, label: '⚠️ Shop prüfen' },
  { type: KAUVIO_FEEDBACK_TYPES.greatDeal, label: '🔥 guter Deal' },
];

export function KauvioFeedbackButtons({
  product,
  query,
  intent,
  searchId,
  sessionId,
  onFeedback,
}) {
  const [selected, setSelected] = useState(null);
  const [loadingType, setLoadingType] = useState(null);
  const [error, setError] = useState(null);

  async function submitFeedback(feedbackType) {
    setLoadingType(feedbackType);
    setError(null);

    const payload = buildProductFeedbackPayload({
      feedbackType,
      product,
      query,
      intent,
      searchId,
      sessionId,
    });

    const result = await sendKauvioFeedback(payload);

    if (!result.ok) {
      setError(result.error ?? 'Feedback konnte nicht gespeichert werden.');
      setLoadingType(null);
      return;
    }

    setSelected(feedbackType);
    setLoadingType(null);
    onFeedback?.({ feedbackType, payload, result });
  }

  return (
    <div className="kauvio-feedback" aria-label="Kauvio Ergebnis bewerten">
      <div className="kauvio-feedback__buttons">
        {FEEDBACK_BUTTONS.map((button) => (
          <button
            key={button.type}
            type="button"
            className={`kauvio-feedback__button${selected === button.type ? ' kauvio-feedback__button--selected' : ''}`}
            disabled={loadingType !== null}
            onClick={() => submitFeedback(button.type)}
          >
            {loadingType === button.type ? 'Speichern…' : button.label}
          </button>
        ))}
      </div>
      {selected ? <p className="kauvio-feedback__status">Danke. Kauvio lernt daraus.</p> : null}
      {error ? <p className="kauvio-feedback__error">{error}</p> : null}
    </div>
  );
}

export default KauvioFeedbackButtons;
