const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai_service:3010'

function decodeHtml(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
}

function stripHtml(html = '') {
  return decodeHtml(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalizeSearchText(input = '') {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function queryTokens(query = '') {
  return normalizeSearchText(query).split(' ').filter(token => token.length >= 2)
}

function hostnameFromUrl(url = '') {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

function absolutizeUrl(baseUrl = '', href = '') {
  try { return new URL(href, baseUrl).toString() } catch { return '' }
}

function looksSwissDomain(hostname = '') {
  return /\.ch$/i.test(hostname)
}

function looksLikeProductUrl(url = '') {
  return /\/product|\/p\/|\/artikel|\/item|\/products?\/|\/dp\/|\/buy\/|\/shop\/|\/de\/s1\/product|\/de\/product/i.test(String(url || ''))
}

function looksLikeSearchUrl(url = '') {
  return /([?&](q|query|search|suche|keyword|text)=)|\/search|\/suche|\/produktsuche|catalogsearch|searchtext|searchresult/i.test(String(url || ''))
}

function normalizePrice(raw) {
  if (raw == null) return null
  const cleaned = String(raw)
    .replace(/CHF/gi, '')
    .replace(/inkl\..*$/i, '')
    .replace(/zzgl\..*$/i, '')
    .replace(/'/g, '')
    .replace(/–/g, '')
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

function dedupeByUrl(items = []) {
  const out = []
  const seen = new Set()
  for (const item of items) {
    if (!item?.url || seen.has(item.url)) continue
    seen.add(item.url)
    out.push(item)
  }
  return out
}

function dedupeCandidates(items = []) {
  const out = []
  const seen = new Set()
  for (const item of items) {
    const key = `${item?.url || ''}|${item?.method || ''}|${item?.reason || ''}`
    if (!item?.url || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function extractImageCandidates(fragment = '', baseUrl = '') {
  const candidates = []
  const srcMatch = fragment.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (srcMatch?.[1]) candidates.push(absolutizeUrl(baseUrl, decodeHtml(srcMatch[1])))
  const dataSrcMatch = fragment.match(/<img[^>]+data-src=["']([^"']+)["']/i)
  if (dataSrcMatch?.[1]) candidates.push(absolutizeUrl(baseUrl, decodeHtml(dataSrcMatch[1])))
  const srcSetMatch = fragment.match(/<img[^>]+srcset=["']([^"']+)["']/i)
  if (srcSetMatch?.[1]) {
    const first = srcSetMatch[1].split(',')[0]?.trim()?.split(/\s+/)?.[0]
    if (first) candidates.push(absolutizeUrl(baseUrl, decodeHtml(first)))
  }
  return candidates.filter(Boolean)
}

function extractOgImage(html = '', baseUrl = '') {
  const match = String(html).match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (match?.[1]) return absolutizeUrl(baseUrl, decodeHtml(match[1]))
  return null
}

function parseShopCatalogCandidates(html = '', pageUrl = '', query = '', provider = '') {
  const baseHost = hostnameFromUrl(pageUrl)
  const items = []
  const matches = [...String(html).matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]

  for (const match of matches) {
    const url = absolutizeUrl(pageUrl, decodeHtml(match[1]))
    const host = hostnameFromUrl(url)
    if (!url || !host || host !== baseHost || !looksSwissDomain(host)) continue
    if (!looksLikeProductUrl(url)) continue

    const fragment = match[2] || ''
    const title = decodeHtml(fragment).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!title || title.length < 8) continue

    const priceMatch = fragment.match(/CHF\s?[0-9'.,]{2,20}/i)
    const imageCandidates = extractImageCandidates(fragment, pageUrl)
    const image_url = imageCandidates[0] || null

    items.push({
      url,
      title,
      provider,
      host,
      query,
      image_url,
      inline_price: normalizePrice(priceMatch?.[0] || null),
    })
  }

  return dedupeByUrl(items)
}

function parseSearchForms(html = '', baseUrl = '') {
  const forms = []
  const formMatches = [...String(html).matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi)]

  for (const match of formMatches) {
    const attrs = match[1] || ''
    const inner = match[2] || ''
    const actionMatch = attrs.match(/action=["']([^"']+)["']/i)
    const methodMatch = attrs.match(/method=["']([^"']+)["']/i)
    const action = absolutizeUrl(baseUrl, decodeHtml(actionMatch?.[1] || baseUrl))
    const method = String(methodMatch?.[1] || 'GET').toUpperCase()
    const inputMatches = [...inner.matchAll(/<input([^>]*)>/gi)]
    let fieldName = null
    let searchLike = false

    for (const input of inputMatches) {
      const inputAttrs = input[1] || ''
      const typeMatch = inputAttrs.match(/type=["']([^"']+)["']/i)
      const nameMatch = inputAttrs.match(/name=["']([^"']+)["']/i)
      const placeholderMatch = inputAttrs.match(/placeholder=["']([^"']+)["']/i)
      const type = String(typeMatch?.[1] || 'text').toLowerCase()
      const name = decodeHtml(nameMatch?.[1] || '').trim()
      const placeholder = decodeHtml(placeholderMatch?.[1] || '').trim().toLowerCase()
      if (!name) continue
      if (['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio'].includes(type)) continue
      const looksSearchField = type === 'search' || /(search|suche|query|keyword|q|text)/i.test(name) || /(such|search)/i.test(placeholder)
      if (!fieldName || looksSearchField) fieldName = name
      if (looksSearchField) searchLike = true
    }

    if (!fieldName || !action) continue
    forms.push({ action, method, fieldName, searchLike })
  }

  return forms
}

function buildUrlFromForm(form, query) {
  if (!form?.action || !form?.fieldName) return null
  try {
    const url = new URL(form.action)
    url.searchParams.set(form.fieldName, query)
    return url.toString()
  } catch {
    return null
  }
}

function buildFallbackSearchCandidates(baseUrl = '', query = '') {
  try {
    const base = new URL(baseUrl)
    const origin = `${base.protocol}//${base.host}`
    const encoded = encodeURIComponent(query)
    const candidates = [
      `${origin}/search?q=${encoded}`,
      `${origin}/search?query=${encoded}`,
      `${origin}/search?search=${encoded}`,
      `${origin}/suche?q=${encoded}`,
      `${origin}/suche?query=${encoded}`,
      `${origin}/suche?search=${encoded}`,
      `${origin}/produktsuche?q=${encoded}`,
      `${origin}/products?search=${encoded}`,
      `${origin}/catalogsearch/result/?q=${encoded}`,
      `${origin}/de/search?q=${encoded}`,
      `${origin}/de/search?query=${encoded}`,
      `${origin}/de/suche?q=${encoded}`,
      `${origin}/de/suche?query=${encoded}`,
      `${origin}/de/searchtext/${encoded}`,
    ]
    return dedupeCandidates(candidates.map(url => ({ url, reason: 'fallback_pattern', method: 'GET' })))
  } catch {
    return []
  }
}

function scoreSearchHtml(html = '', searchUrl = '', query = '') {
  const text = normalizeSearchText(stripHtml(html))
  const tokens = queryTokens(query)
  const candidateCount = parseShopCatalogCandidates(html, searchUrl, query, '').length
  const queryHits = tokens.filter(token => text.includes(token)).length
  const priceHits = (String(html).match(/CHF\s?[0-9]/gi) || []).length
  const titleLikeHits = (String(html).match(/<h[1-4][^>]*>/gi) || []).length
  const emptySignals = /(keine treffer|0 treffer|no results|nichts gefunden|leider nichts gefunden)/i.test(html)
  const homeSignals = /(newsletter|hero-banner|unsere angebote|beliebte kategorien)/i.test(html)
  let score = 0
  score += Math.min(24, queryHits * 6)
  score += Math.min(40, candidateCount * 4)
  score += Math.min(10, priceHits)
  score += Math.min(6, titleLikeHits)
  if (looksLikeSearchUrl(searchUrl)) score += 6
  if (emptySignals) score -= 20
  if (homeSignals && candidateCount < 2) score -= 8
  return score
}

async function tryFetch(url, fetchText, timeoutMs = null) {
  try {
    const html = timeoutMs == null ? await fetchText(url) : await fetchText(url, timeoutMs)
    return { ok: true, html }
  } catch (error) {
    return { ok: false, error: String(error?.message || error || 'Unknown error') }
  }
}

async function resolveShopSearchContext({ task, source, swissSource, fetchText, logImportDiagnostic = null }) {
  const query = task.query || source.seed_value || ''
  const homepageUrl = swissSource?.base_url || (source.seed_value && /^https?:\/\//i.test(source.seed_value) ? source.seed_value : null)
  const candidates = []

  if (swissSource?.search_url_template) {
    candidates.push({
      url: swissSource.search_url_template.replace('{query}', encodeURIComponent(query)),
      reason: 'configured_template',
      method: 'GET',
    })
  }

  let homepageHtml = null
  if (homepageUrl && /^https?:\/\//i.test(homepageUrl)) {
    const homepageResult = await tryFetch(homepageUrl, fetchText)
    if (homepageResult.ok) {
      homepageHtml = homepageResult.html
      for (const form of parseSearchForms(homepageHtml, homepageUrl)) {
        const built = buildUrlFromForm(form, query)
        if (!built) continue
        candidates.push({
          url: built,
          reason: form.searchLike ? 'homepage_search_form' : 'homepage_form_guess',
          method: form.method,
        })
      }
      candidates.push(...buildFallbackSearchCandidates(homepageUrl, query))
    } else if (typeof logImportDiagnostic === 'function') {
      await logImportDiagnostic({
        searchTaskId: task.id,
        searchTaskSourceId: source.id,
        stage: 'shop_catalog_homepage_fetch',
        status: 'warning',
        message: 'Could not load shop homepage for search-url discovery',
        payload: { provider: source.provider, homepageUrl, error: homepageResult.error },
      })
    }
  }

  const uniqueCandidates = dedupeCandidates(candidates)
  let best = null

  for (const candidate of uniqueCandidates.slice(0, 18)) {
    const fetched = await tryFetch(candidate.url, fetchText)
    if (!fetched.ok) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({
          searchTaskId: task.id,
          searchTaskSourceId: source.id,
          stage: 'shop_catalog_search_candidate',
          status: 'warning',
          message: 'Search candidate fetch failed',
          payload: { provider: source.provider, candidateUrl: candidate.url, reason: candidate.reason, error: fetched.error },
        })
      }
      continue
    }

    const score = scoreSearchHtml(fetched.html, candidate.url, query)
    const item = { ...candidate, searchUrl: candidate.url, searchHtml: fetched.html, score }
    if (!best || item.score > best.score) best = item
  }

  if (typeof logImportDiagnostic === 'function') {
    await logImportDiagnostic({
      searchTaskId: task.id,
      searchTaskSourceId: source.id,
      stage: 'shop_catalog_search_url_resolution',
      status: best ? 'success' : 'warning',
      message: best ? 'Resolved shop search URL dynamically' : 'Could not resolve a shop search URL',
      payload: {
        provider: source.provider,
        query,
        homepageUrl,
        bestSearchUrl: best?.searchUrl || null,
        bestScore: best?.score || 0,
        candidateCount: uniqueCandidates.length,
      },
    })
  }

  return {
    query,
    homepageUrl,
    homepageHtml,
    searchUrl: best?.searchUrl || null,
    searchHtml: best?.searchHtml || null,
    searchScore: best?.score || 0,
  }
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

export async function importFromShopCatalog({
  task,
  source,
  swissSource,
  fetchText,
  storeSourceOffers,
  canonicalModelKey,
  brandFromTitle,
  sanitizeSourceKey,
  logImportDiagnostic = null,
}) {
  const resolved = await resolveShopSearchContext({ task, source, swissSource, fetchText, logImportDiagnostic })
  const query = resolved.query
  const searchUrl = resolved.searchUrl
  const searchHtml = resolved.searchHtml

  if (!searchUrl || !searchHtml) {
    if (typeof logImportDiagnostic === 'function') {
      await logImportDiagnostic({
        searchTaskId: task.id,
        searchTaskSourceId: source.id,
        stage: 'shop_catalog_search_url',
        status: 'warning',
        message: 'No usable search URL for shop catalog source',
        payload: { provider: source.provider, searchUrl, query, homepageUrl: resolved.homepageUrl },
      })
    }
    return { discovered: 0, imported: 0, sourceKey: source.provider }
  }

  const inlineOgImage = extractOgImage(searchHtml, searchUrl)
  const candidates = parseShopCatalogCandidates(searchHtml, searchUrl, query, source.provider)
  const picked = candidates.slice(0, 12)

  if (typeof logImportDiagnostic === 'function') {
    await logImportDiagnostic({
      searchTaskId: task.id,
      searchTaskSourceId: source.id,
      stage: 'shop_catalog_candidates',
      status: picked.length ? 'success' : 'warning',
      message: `Parsed ${picked.length} shop catalog candidates`,
      payload: { provider: source.provider, query, searchUrl, searchScore: resolved.searchScore, candidates: picked.slice(0, 5) },
    })
  }

  const offers = []
  for (const candidate of picked) {
    try {
      const productHtml = await fetchText(candidate.url)
      const extraction = await callAiExtract({
        html: productHtml,
        url: candidate.url,
        query,
        source: `shop_catalog:${source.provider}`,
      })

      if (!extraction?.title) continue

      const brand = extraction.brand || brandFromTitle(extraction.title)
      const model_key = extraction.model_key || canonicalModelKey({
        brand,
        title: extraction.title,
        specs: [extraction.mpn, extraction.ean_gtin].filter(Boolean).join(' '),
      })

      const image_url =
        extraction.image_url ||
        candidate.image_url ||
        extractOgImage(productHtml, candidate.url) ||
        inlineOgImage ||
        null

      offers.push({
        provider: sanitizeSourceKey(source.provider) || source.provider,
        provider_group: 'shop_catalog',
        offer_title: extraction.title,
        brand,
        category: extraction.category || null,
        model_key,
        ean_gtin: extraction.ean_gtin || null,
        mpn: extraction.mpn || null,
        price: extraction.price ?? candidate.inline_price ?? null,
        currency: extraction.currency || 'CHF',
        availability: extraction.availability || null,
        condition_text: null,
        image_url,
        deeplink_url: extraction.deeplink_url || candidate.url,
        source_product_url: extraction.source_product_url || candidate.url,
        confidence_score: Number(extraction.confidence_score || 0.7),
        extraction_method: extraction.extraction_method || 'shop_catalog_ai_extract',
        extracted_json: {
          query,
          provider: source.provider,
          search_url: searchUrl,
          search_score: resolved.searchScore,
          candidate_title: candidate.title,
          candidate_image_url: candidate.image_url || null,
          extraction,
        },
      })
    } catch (err) {
      if (typeof logImportDiagnostic === 'function') {
        await logImportDiagnostic({
          searchTaskId: task.id,
          searchTaskSourceId: source.id,
          stage: 'shop_catalog_product_fetch',
          status: 'error',
          message: String(err?.message || err),
          payload: { provider: source.provider, url: candidate.url, query, searchUrl },
        })
      }
    }
  }

  const imported = await storeSourceOffers(
    task.id,
    { ...source, provider: source.provider, source_kind: 'shop_catalog', seed_value: query },
    offers,
    searchUrl,
    'shop_catalog_import',
    source.id
  )

  return {
    discovered: picked.length,
    imported,
    sourceKey: swissSource?.source_key || source.provider,
  }
}
