const EXCLUDED_DISCOVERY_HOSTS = ['toppreise.ch', 'duckduckgo.com', 'html.duckduckgo.com', 'lite.duckduckgo.com', 'google.com', 'www.google.com', 'bing.com', 'search.yahoo.com']
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai_service:3010'

function decodeHtml(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&auml;/gi, 'ä')
    .replace(/&#x27;/g, "'")
}

function hostnameFromUrl(url = '') {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

function looksSwissDomain(hostname = '') {
  return /\.ch$/i.test(hostname)
}

function isExcludedDiscoveryHost(host = '') {
  return EXCLUDED_DISCOVERY_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))
}

function looksLikeProductUrl(url = '') {
  return /\/product|\/p\/|\/artikel|\/item|\/products?\/|\/dp\/|\/buy\/|\/shop\//i.test(String(url || ''))
}

function normalizeResult(url, title, query, source) {
  const host = hostnameFromUrl(url)
  if (!url || !host || isExcludedDiscoveryHost(host) || !looksSwissDomain(host)) return null
  if (!title || title.length < 8) return null
  return { url, title, snippet: '', host, query, source }
}

function parseDuckDuckGoResults(html = '', query = '', source = 'duckduckgo_html') {
  const results = []
  const matches = [...String(html).matchAll(/<a[^>]+(?:class=["'][^"']*(?:result__a|result-link)[^"']*["'])?[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  for (const match of matches) {
    let url = decodeHtml(match[1])
    const title = decodeHtml(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const uddg = url.match(/[?&]uddg=([^&]+)/)
    if (uddg?.[1]) url = decodeURIComponent(uddg[1])
    const item = normalizeResult(url, title, query, source)
    if (item) results.push(item)
  }
  return dedupeResults(results)
}

function parseGoogleResults(html = '', query = '') {
  const results = []
  const urlMatches = [...String(html).matchAll(/href=["']\/url\?q=([^"'&]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
  for (const match of urlMatches) {
    const url = decodeURIComponent(match[1])
    const title = decodeHtml(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const item = normalizeResult(url, title, query, 'google_html')
    if (item) results.push(item)
  }
  return dedupeResults(results)
}

function absolutizeUrl(baseUrl = '', href = '') {
  try { return new URL(href, baseUrl).toString() } catch { return '' }
}

function parseGenericAnchorResults(html = '', pageUrl = '', query = '', source = 'direct_shop_search') {
  const out = []
  const baseHost = hostnameFromUrl(pageUrl)
  const matches = [...String(html).matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  for (const match of matches) {
    const url = absolutizeUrl(pageUrl, decodeHtml(match[1]))
    const title = decodeHtml(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const host = hostnameFromUrl(url)
    if (!url || !host || host !== baseHost) continue
    if (!looksSwissDomain(host) || isExcludedDiscoveryHost(host)) continue
    if (!title || title.length < 8) continue
    out.push({ url, title, snippet: '', host, query, source })
  }
  return dedupeResults(out)
}

function dedupeResults(results = []) {
  const unique = []
  const seen = new Set()
  for (const item of results) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    unique.push(item)
  }
  return unique
}

function errorMessage(err) {
  return String(err?.message || err || 'Unknown error')
}

async function collectEngineResults({ task, searchTimeout, searchTerms, fetchText, logImportDiagnostic = null }) {
  const allResults = []
  for (const term of searchTerms) {
    try {
      const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(term)}`, searchTimeout)
      allResults.push(...parseDuckDuckGoResults(html, task.query, 'duckduckgo_html'))
    } catch (err) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({ searchTaskId: task.id, stage: 'open_web_search_engine', status: 'warning', message: 'DuckDuckGo HTML search failed', payload: { term, engine: 'duckduckgo_html', error: errorMessage(err) } })
      }
    }
    try {
      const htmlLite = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(term)}`, searchTimeout)
      allResults.push(...parseDuckDuckGoResults(htmlLite, task.query, 'duckduckgo_lite'))
    } catch (err) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({ searchTaskId: task.id, stage: 'open_web_search_engine', status: 'warning', message: 'DuckDuckGo Lite search failed', payload: { term, engine: 'duckduckgo_lite', error: errorMessage(err) } })
      }
    }
    try {
      const googleHtml = await fetchText(`https://www.google.com/search?hl=de&gl=ch&num=10&q=${encodeURIComponent(term)}`, searchTimeout)
      allResults.push(...parseGoogleResults(googleHtml, task.query))
    } catch (err) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({ searchTaskId: task.id, stage: 'open_web_search_engine', status: 'warning', message: 'Google HTML search failed', payload: { term, engine: 'google_html', error: errorMessage(err) } })
      }
    }
  }
  return allResults
}

async function collectDirectShopResults({ task, plannerSources = [], searchTimeout, fetchText, logImportDiagnostic = null }) {
  const directResults = []
  const directSources = plannerSources
    .filter((source) => source?.search_url_template && looksSwissDomain(hostnameFromUrl(source.base_url || source.search_url_template)))
    .slice(0, 12)

  for (const source of directSources) {
    try {
      const searchUrl = source.search_url_template.replace('{query}', encodeURIComponent(task.query || ''))
      const html = await fetchText(searchUrl, searchTimeout)
      directResults.push(...parseGenericAnchorResults(html, searchUrl, task.query, `direct_shop_search:${source.source_key}`))
    } catch (err) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({ searchTaskId: task.id, stage: 'open_web_direct_shop', status: 'warning', message: 'Direct shop search failed', payload: { sourceKey: source.source_key, error: errorMessage(err) } })
      }
    }
  }
  return directResults
}

async function callAiExtract({ html, url, query, source }) {
  const res = await fetch(`${AI_SERVICE_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, url, query, source }),
  })
  if (!res.ok) throw new Error(`AI extract HTTP ${res.status}`)
  const data = await res.json()
  return data?.extraction || null
}

function buildOfferFromExtraction(extraction, { sanitizeSourceKey, canonicalModelKey, brandFromTitle, query }, item) {
  if (!extraction?.title) return null
  const brand = extraction.brand || brandFromTitle(extraction.title)
  const modelKey = extraction.model_key || canonicalModelKey({
    brand,
    title: extraction.title,
    specs: [extraction.mpn, extraction.ean_gtin].filter(Boolean).join(' '),
  })
  return {
    provider: sanitizeSourceKey(item.host) || item.host,
    provider_group: 'open_web',
    offer_title: extraction.title,
    brand,
    category: extraction.category || null,
    model_key: modelKey,
    ean_gtin: extraction.ean_gtin || null,
    mpn: extraction.mpn || null,
    price: extraction.price || null,
    currency: extraction.currency || 'CHF',
    availability: extraction.availability || null,
    condition_text: null,
    image_url: extraction.image_url || null,
    deeplink_url: extraction.deeplink_url || item.url,
    source_product_url: extraction.source_product_url || item.url,
    confidence_score: Number(extraction.confidence_score || 0.6),
    extraction_method: extraction.extraction_method || 'ai_extract',
    extracted_json: { query, host: item.host, source: item.source, extraction },
  }
}

export async function runOpenWebDiscovery({
  task,
  controlMap,
  plannerSources = [],
  inferIntent,
  brandFromTitle,
  sanitizeSourceKey,
  canonicalModelKey,
  registerDiscoveredShop,
  insertWebDiscoveryResult,
  storeSourceOffers,
  fetchText,
  logImportDiagnostic = null,
}) {
  const openWeb = controlMap.get('open_web_discovery')
  if (openWeb?.is_enabled === false) return { discovered: 0, imported: 0, sourceKeys: [] }

  const resultLimit = Number(openWeb?.control_value_json?.result_limit || 24)
  const productFetchLimit = Number(openWeb?.control_value_json?.product_fetch_limit || 16)
  const searchTimeout = Number(openWeb?.control_value_json?.search_timeout_ms || 25000)
  const intentTags = inferIntent(task.query || '')
  const searchTerms = [
    `${task.query} site:.ch kaufen preis`,
    `${task.query} site:.ch shop`,
    `${task.query} site:.ch produkt`,
    `${task.query} schweiz kaufen`,
  ]

  const engineResults = await collectEngineResults({ task, searchTimeout, searchTerms, fetchText, logImportDiagnostic })
  const directShopResults = await collectDirectShopResults({ task, plannerSources, searchTimeout, fetchText, logImportDiagnostic })
  const allResults = [...engineResults, ...directShopResults]

  const unique = []
  const seen = new Set()
  for (const item of allResults) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    unique.push(item)
    if (unique.length >= resultLimit) break
  }

  let discovered = 0
  let imported = 0
  const sourceKeys = []

  for (let i = 0; i < unique.length; i++) {
    const item = unique[i]
    const shop = await registerDiscoveredShop(item.url, intentTags, item.source.startsWith('direct_shop_search') ? 'direct_shop_search' : 'open_web_search')
    if (shop?.source_key) sourceKeys.push(shop.source_key)
    await insertWebDiscoveryResult(task, item, i + 1, { search_source: item.source }, !!shop, false)
    discovered += 1
  }

  for (const item of unique.filter((entry, idx) => looksLikeProductUrl(entry.url) || idx < productFetchLimit).slice(0, productFetchLimit)) {
    try {
      const html = await fetchText(item.url, searchTimeout)
      const extraction = await callAiExtract({ html, url: item.url, query: task.query, source: item.source })
      const offer = buildOfferFromExtraction(extraction, { sanitizeSourceKey, canonicalModelKey, brandFromTitle, query: task.query }, item)
      if (!offer) {
        if (typeof logImportDiagnostic === 'function') {
          await logImportDiagnostic({ searchTaskId: task.id, stage: 'open_web_product_parse', status: 'warning', message: 'AI extraction could not produce an offer', payload: { url: item.url, host: item.host, source: item.source } })
        }
        continue
      }
      const inserted = await storeSourceOffers(task.id, { provider: sanitizeSourceKey(item.host) || item.host, source_kind: 'open_web_product', seed_value: task.query }, [offer], item.url, item.source.startsWith('direct_shop_search') ? 'direct_shop_search' : 'open_web_product')
      if (inserted > 0) {
        await insertWebDiscoveryResult(task, item, 0, { extraction, inserted }, true, true)
        imported += inserted
        if (item.host) sourceKeys.push(sanitizeSourceKey(item.host) || item.host)
      }
    } catch (err) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({ searchTaskId: task.id, stage: 'open_web_product_fetch', status: 'error', message: 'Product page fetch or AI parse failed', payload: { url: item.url, host: item.host, source: item.source, error: errorMessage(err) } })
      }
    }
  }

  return { discovered, imported, sourceKeys: [...new Set(sourceKeys)] }
}
