# Kauvio AI Rebuild – Integrationsnotizen

Dieses Bundle enthält komplette neue Dateien für:

- `services/ai_service/ai_service.mjs`
- `services/worker/open_web_discovery.mjs`
- `webapp/src/Root.jsx`
- `webapp/src/HomePageProfessional.jsx`
- `webapp/src/SearchSuggestBox.jsx`
- `webapp/src/swiss-home.css`

## 1) Worker an `ai_service` anbinden

In `services/worker/worker.mjs` direkt nach `FETCH_TIMEOUT_MS` ergänzen:

```js
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai_service:3010'
```

Danach diese Helper-Funktion einfügen, ideal direkt nach `fetchText(...)`:

```js
async function callAiServiceJson(path, payload, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error || `AI service HTTP ${response.status}`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

async function aiExtractProduct(payload) {
  const data = await callAiServiceJson('/extract', payload)
  return data?.extracted || null
}
```

Dann den bestehenden Aufruf von `runOpenWebDiscovery(...)` in `processSearchTask` so erweitern:

```js
const openWebResult = await runOpenWebDiscovery({
  task,
  controlMap,
  plannerSources,
  inferIntent,
  clean,
  brandFromTitle,
  normalizePrice,
  sanitizeSourceKey,
  canonicalModelKey,
  registerDiscoveredShop,
  insertWebDiscoveryResult,
  storeSourceOffers: (taskId, source, offers, pageUrl, discoverySourceKey) =>
    storeSourceOffers(taskId, source, offers, pageUrl, discoverySourceKey, null),
  fetchText,
  aiExtractProduct,
  logImportDiagnostic,
})
```

## 2) Produkt-Suggestions im Server ergänzen

In `webapp/server/index.mjs` direkt **vor** `app.get('/api/products', ...)` ergänzen:

```js
app.get('/api/products/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.json({ items: [] })

  const productRows = await pool.query(
    `SELECT p.slug, p.title, p.brand, p.category, p.ai_summary, p.deal_score, p.image_url,
            COALESCE(MIN(o.price), p.price) AS price,
            COALESCE((ARRAY_AGG(o.shop_name ORDER BY o.price ASC, o.updated_at DESC))[1], p.shop_name) AS shop_name,
            COUNT(o.*)::int AS offer_count,
            MAX(p.updated_at) AS updated_at
     FROM products p
     LEFT JOIN product_offers o ON o.product_slug = p.slug AND COALESCE(o.is_hidden, false) = false
     WHERE p.title ILIKE $1 OR p.brand ILIKE $1 OR p.category ILIKE $1
     GROUP BY p.slug, p.title, p.brand, p.category, p.ai_summary, p.deal_score, p.price, p.shop_name, p.image_url
     ORDER BY updated_at DESC, price ASC NULLS LAST
     LIMIT 8`,
    [`%${q}%`]
  ).catch(() => ({ rows: [] }))

  const productItems = productRows.rows.map((r) => ({
    ...r,
    price: r.price != null ? Number(r.price) : null,
    decision: r.deal_score >= 88 ? { label: 'Jetzt kaufen' } : r.deal_score >= 78 ? { label: 'Guter Kauf' } : { label: 'Live Preis' },
  }))

  const canonicalItems = await fetchCanonicalSearchResults(pool, q, 8).catch(() => [])
  const items = mergeSearchResults(productItems, canonicalItems, 8)
  res.json({ items })
})
```

## 3) AI-first bei normaler Suche aggressiver machen

Im bestehenden `/api/products`-Handler diese Zeile:

```js
if (q && items.length === 0) liveSearch = await enqueueLiveSearchTask(pool, q, 'public_search').catch(() => null)
```

ersetzen durch:

```js
if (q && items.length < 5) {
  liveSearch = await enqueueLiveSearchTask(pool, q, 'public_search').catch(() => null)
}
```

Damit startet die AI-Live-Suche nicht erst bei **0** Treffern, sondern schon bei schwachem lokalem Bestand.

## 4) ENV prüfen

Diese Variablen müssen gesetzt sein:

```env
AI_SERVICE_URL=http://ai_service:3010
OPENAI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

## 5) Was dieses Bundle funktional verbessert

- minimalistische Startseite, suchmaschinenartig
- große Marke / Wordmark
- explizite Buttons für normale Suche und Live-KI-Suche
- Suggest-Box mit sauberem Dropdown
- AI-Service mit echten Endpoints:
  - `/extract`
  - `/match`
  - `/rank`
  - `/search-plan`
  - `/evaluate`
- Open-Web-Discovery mit AI-Extraktions-Fallback bzw. AI-first-Präferenz

## 6) Noch offen für „wirklich vollautomatisch“

Für den nächsten großen Schritt würde ich zusätzlich bauen:

- AI-gestütztes Canonical-Matching in `ensureCanonicalFromOffers`
- AI-Ranking direkt in `fetchCanonicalSearchResults`
- Learning-Loop aus Klickdaten und erfolgreichen Suchanfragen
- Background-Enrichment für Bilder, Spezifikationen und Preisverlauf
