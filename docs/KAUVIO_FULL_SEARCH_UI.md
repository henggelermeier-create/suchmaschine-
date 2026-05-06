# Kauvio Full Search UI

PR #92 integriert alle vorhandenen Kauvio Frontend-Bausteine in eine vollständige Suchseiten-Komponente.

## Aktualisiert

```txt
webapp/src/kauvioAiSearchClient.js
```

Der Client nutzt jetzt standardmäßig:

```txt
/api/kauvio/ai-search-price
```

Fallback-Reihenfolge:

```txt
/api/kauvio/ai-search-price
/api/kauvio/ai-search-trust
/api/kauvio/ai-search-feedback
/api/kauvio/ai-search
```

## Neue Dateien

```txt
webapp/src/KauvioBuyTimingBadge.jsx
webapp/src/kauvio-buy-timing.css
webapp/src/KauvioSearchPage.jsx
webapp/src/kauvio-search-page.css
```

## Integrierte UI-Bausteine

```txt
KauvioAiAdvisor
KauvioProductCard
KauvioFeedbackButtons
KauvioFeedbackSignal
KauvioShopTrustBadge
KauvioCanonicalOffers
KauvioBuyTimingBadge
```

## Verwendung

```jsx
import { KauvioSearchPage } from './KauvioSearchPage.jsx';

export default function App() {
  return <KauvioSearchPage />;
}
```

## Was die Seite zeigt

```txt
KI-Kaufberater
Produktkarten
Kauvio Score
Feedback-Signale
Feedback-Buttons
Shop-Trust-Badges
Canonical Offers / Händlervergleich
Kaufzeitpunkt: jetzt kaufen / warten / neutral
KI-Suchplan
Engine-Meta
```

## Stand

Die komplette Kauvio-Suchseite ist jetzt als eigenständige React-Komponente vorhanden. Falls die bestehende App-Datei weiterhin nicht zuverlässig automatisch lesbar ist, kann diese Komponente manuell oder in einem Folge-PR als Route/Startseite eingebunden werden.

## Nächste Schritte

Nach Merge von PR #92:

1. `KauvioSearchPage` als Hauptsuchseite routen oder in `App.jsx` rendern.
2. Server-Route `/api/kauvio/ai-search-price` aktivieren.
3. Produktion mit echter Datenbank testen.
