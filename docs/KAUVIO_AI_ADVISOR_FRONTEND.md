# Kauvio AI Advisor Frontend

PR #76 ergänzt Frontend-Bausteine für die Kauvio KI-Produktsuche.

## Neue Dateien

```txt
webapp/src/kauvioAiSearchClient.js
webapp/src/useKauvioAiSearch.js
webapp/src/KauvioAiAdvisor.jsx
webapp/src/kauvio-ai-advisor.css
```

## Ziel

Die Suchseite soll nicht nur Produkte anzeigen, sondern eine KI-Kaufberatung liefern:

```txt
Top-Empfehlung
Bester Deal
Günstige Alternative
Premium-Alternative
Warnungen
Kauvio Score
Ranking-Gründe
```

## Beispielintegration

```jsx
import './kauvio-ai-advisor.css';
import { KauvioAiAdvisor } from './KauvioAiAdvisor.jsx';
import { useKauvioAiSearch } from './useKauvioAiSearch.js';

function SearchPage() {
  const {
    query,
    setQuery,
    runSearch,
    products,
    advisor,
    intent,
    loading,
    error,
  } = useKauvioAiSearch('', { limit: 24 });

  return (
    <main>
      <form onSubmit={(event) => { event.preventDefault(); runSearch(query); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit">Suchen</button>
      </form>

      <KauvioAiAdvisor
        advisor={advisor}
        products={products}
        intent={intent}
        loading={loading}
        error={error}
      />
    </main>
  );
}
```

## API

Der Client nutzt standardmäßig:

```txt
/api/kauvio/ai-search
```

## Ergebnis

Produkte werden mit KI-Informationen dargestellt:

```txt
kauvio_score
ranking_reasons
decision_badge
advisor.summary
advisor.top_recommendation
advisor.best_deal
advisor.budget_alternative
advisor.premium_alternative
advisor.warnings
```

## Nächster Schritt

Nach Merge von PR #76:

1. Bausteine in die bestehende Suchseite einbauen.
2. Bestehende Produktliste durch `KauvioAiAdvisor` ergänzen oder ersetzen.
3. Danach Feedback-Buttons für Lernen aus Nutzersignalen ergänzen.
