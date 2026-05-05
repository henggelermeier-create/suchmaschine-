# Kauvio Feedback UI

PR #80 stellt das Frontend auf die feedback-optimierte Kauvio Suche um und ergänzt eine UI-Komponente für sichtbare Feedback-Signale.

## Änderungen

```txt
webapp/src/kauvioAiSearchClient.js
webapp/src/KauvioFeedbackSignal.jsx
webapp/src/kauvio-feedback-signal.css
```

## Neuer Standard-Endpunkt

Der Frontend-Client nutzt jetzt standardmäßig:

```txt
/api/kauvio/ai-search-feedback
```

Falls dieser Endpunkt noch nicht verfügbar ist, fällt der Client bei 404 automatisch zurück auf:

```txt
/api/kauvio/ai-search
```

## Feedback-Signal anzeigen

```jsx
import './kauvio-feedback-signal.css';
import { KauvioFeedbackSignal } from './KauvioFeedbackSignal.jsx';

<KauvioFeedbackSignal product={product} />
```

## Beispiel in Produktkarte

```jsx
<KauvioProductCard product={product} />
<KauvioFeedbackSignal product={product} />
```

## Angezeigte Signale

Positive Feedback-Signale:

```txt
Nutzer bestätigen: +6 Score
```

Negative Feedback-Signale:

```txt
Nutzerhinweis: -5 Score
```

Neutrale Signale:

```txt
12 Nutzerfeedbacks berücksichtigt
```

## Ziel

Nutzer sollen sehen, dass Kauvio aus echtem Feedback lernt und nicht nur statisch sortiert.
