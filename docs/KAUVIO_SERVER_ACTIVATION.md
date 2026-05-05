# Kauvio Server Activation

PR #75 ergänzt einen zentralen Aktivierungshelfer für die Kauvio AI Search.

## Neue Datei

```txt
webapp/server/kauvio_server_activation.mjs
```

## Verwendung

In der zentralen Serverdatei kann Kauvio mit einem Aufruf aktiviert werden:

```js
import { activateKauvioServerFeatures } from './kauvio_server_activation.mjs';

await activateKauvioServerFeatures(app);
```

Der Aufruf registriert die Kauvio AI Search, sofern sie über die Konfiguration aktiviert ist.

## Konfiguration

```txt
KAUVIO_AI_SEARCH_ENABLED=true
KAUVIO_AI_SEARCH_ALIAS_ENABLED=true
```

`KAUVIO_AI_SEARCH_ENABLED=false` deaktiviert die Registrierung.

`KAUVIO_AI_SEARCH_ALIAS_ENABLED=false` deaktiviert den Alias `/api/search/ai`.

## Datenbank

Die Live-Suche nutzt die Datenbank-Konfiguration aus dem bestehenden Live-AI-Search-Modul. Unterstützte Variablen:

```txt
DATABASE_URL
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
```

## Erwartete API

Nach Aktivierung:

```txt
/api/kauvio/ai-search
```

Optional zusätzlich:

```txt
/api/search/ai
```

Die Antwort enthält KI-Suchinformationen wie Intent, Search Plan, Advisor, Kauvio Score und Ranking-Gründe.
