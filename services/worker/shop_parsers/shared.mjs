export function decodeHtml(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
}

export function stripHtml(html = '') {
  return decodeHtml(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
}

export function normalizeSearchText(input = '') {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function queryTokens(query = '') {
  return normalizeSearchText(query).split(' ').filter(token => token.length >= 2)
}

export function cleanCommerceQuery(query = '') {
  const removeTokens = new Set([
    'schweiz', 'schweizer', 'swiss', 'preisvergleich', 'bestpreis', 'preis', 'vergleich',
    'angebote', 'angebot', 'deals', 'deal', 'kaufen', 'kauf', 'shop', 'shops', 'online',
    'guenstig', 'gunstig', 'aktion', 'sale', 'ch',
  ])
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean)
  const filtered = tokens.filter(token => !removeTokens.has(token))
  const cleaned = filtered.join(' ').trim()
  return cleaned || normalizeSearchText(query)
}

export function hostnameFromUrl(url = '') {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

export function absolutizeUrl(baseUrl = '', href = '') {
  try { return new URL(href, baseUrl).toString() } catch { return '' }
}

export function looksSwissDomain(hostname = '') {
  return /\.ch$/i.test(hostname)
}

export function looksLikeSearchUrl(url = '') {
  return /([?&](q|query|search|suche|keyword|text)=)|\/search|\/suche|\/produktsuche|catalogsearch|searchtext|searchresult|listing\.xhtml/i.test(String(url || ''))
}

export function looksLikeProductUrl(url = '', query = '') {
  const raw = String(url || '')
  if (!raw || looksLikeSearchUrl(raw)) return false
  if (/\/cart|\/checkout|\/login|\/konto|\/account|\/service|\/hilfe|\/help|\/brand|\/marke|\/category|\/kategorie|\/blog|\/magazin|\/jobs/i.test(raw)) return false
  if (/\/product|\/p\/|\/artikel|\/item|\/products?\/|\/dp\/|\/buy\/|\/shop\/|\/de\/s1\/product|\/de\/product/i.test(raw)) return true
  const path = (() => { try { return new URL(raw).pathname } catch { return raw } })()
  if (/\d{5,}/.test(path)) return true
  const tokens = queryTokens(cleanCommerceQuery(query))
  const normalizedPath = normalizeSearchText(path.replace(/[-_]+/g, ' '))
  const hits = tokens.filter(token => normalizedPath.includes(token)).length
  return hits >= Math.min(2, tokens.length || 0)
}

export function normalizePrice(raw) {
  if (raw == null) return null
  const cleaned = String(raw)
    .replace(/CHF/gi, '')
    .replace(/inkl\..*$/i, '')
    .replace(/zzgl\..*$/i, '')
    .replace(/'/g, '')
    .replace(/–/g, '')
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

export function dedupeByUrl(items = []) {
  const out = []
  const seen = new Set()
  for (const item of items) {
    if (!item?.url || seen.has(item.url)) continue
    seen.add(item.url)
    out.push(item)
  }
  return out
}

export function dedupeCandidates(items = []) {
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

export function extractImageCandidates(fragment = '', baseUrl = '') {
  const candidates = []
  const srcMatch = fragment.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (srcMatch?.[1]) candidates.push(absolutizeUrl(baseUrl, decodeHtml(srcMatch[1])))
  const dataSrcMatch = fragment.match(/<img[^>]+(?:data-src|data-image|data-original)=["']([^"']+)["']/i)
  if (dataSrcMatch?.[1]) candidates.push(absolutizeUrl(baseUrl, decodeHtml(dataSrcMatch[1])))
  const srcSetMatch = fragment.match(/<img[^>]+srcset=["']([^"']+)["']/i)
  if (srcSetMatch?.[1]) {
    const first = srcSetMatch[1].split(',')[0]?.trim()?.split(/\s+/)?.[0]
    if (first) candidates.push(absolutizeUrl(baseUrl, decodeHtml(first)))
  }
  return [...new Set(candidates.filter(Boolean))]
}

export function extractOgImage(html = '', baseUrl = '') {
  const match = String(html).match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (match?.[1]) return absolutizeUrl(baseUrl, decodeHtml(match[1]))
  return null
}

export function countTokenHits(text = '', tokens = []) {
  const normalized = normalizeSearchText(text)
  return tokens.filter(token => normalized.includes(token)).length
}

export function extractAnchorLabel(anchorAttrs = '', fragment = '') {
  const ariaMatch = anchorAttrs.match(/aria-label=["']([^"']+)["']/i)
  const titleAttrMatch = anchorAttrs.match(/title=["']([^"']+)["']/i)
  const attrLabel = decodeHtml(ariaMatch?.[1] || titleAttrMatch?.[1] || '').trim()
  const fragmentLabel = decodeHtml(fragment).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return attrLabel || fragmentLabel
}

export function extractPriceText(text = '') {
  const match = String(text || '').match(/CHF\s?[0-9'.,]{2,20}/i)
  return match?.[0] || null
}

export function rankCandidates(items = []) {
  return dedupeByUrl(items).sort((a, b) => {
    const aScore = (a.title_hit_count * 4) + (a.url_hit_count * 2) + (a.inline_price != null ? 2 : 0) + (a.image_url ? 1 : 0)
    const bScore = (b.title_hit_count * 4) + (b.url_hit_count * 2) + (b.inline_price != null ? 2 : 0) + (b.image_url ? 1 : 0)
    return bScore - aScore
  })
}

export function parseAnchorCandidates(html = '', pageUrl = '', query = '', provider = '') {
  const baseHost = hostnameFromUrl(pageUrl)
  const items = []
  const cleanedQuery = cleanCommerceQuery(query)
  const tokens = queryTokens(cleanedQuery)
  const matches = [...String(html).matchAll(/<a([^>]*)href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]

  for (const match of matches) {
    const anchorAttrs = match[1] || ''
    const url = absolutizeUrl(pageUrl, decodeHtml(match[2]))
    const host = hostnameFromUrl(url)
    if (!url || !host || host !== baseHost || !looksSwissDomain(host)) continue
    if (!looksLikeProductUrl(url, cleanedQuery)) continue

    const fragment = match[3] || ''
    const title = extractAnchorLabel(anchorAttrs, fragment)
    if (!title || title.length < 5) continue

    const titleHitCount = countTokenHits(title, tokens)
    const urlHitCount = countTokenHits(url, tokens)
    if (tokens.length && titleHitCount === 0 && urlHitCount === 0) continue

    const whole = `${anchorAttrs} ${fragment}`
    const imageCandidates = extractImageCandidates(whole, pageUrl)
    items.push({
      url,
      title,
      provider,
      image_url: imageCandidates[0] || null,
      inline_price: normalizePrice(extractPriceText(whole)),
      title_hit_count: titleHitCount,
      url_hit_count: urlHitCount,
      source_kind_hint: 'anchor',
    })
  }

  return items
}

export function collectContainerFragments(html = '') {
  const fragments = []
  const patterns = [
    /<(article|li|div)[^>]+(?:data-testid|data-test|class)=["'][^"']*(product|item|tile|card|result|listing|offer)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
    /<(article|li|div)[^>]+(?:data-product|data-product-id|data-article-number|data-sku)=["'][^"']+["'][^>]*>([\s\S]*?)<\/\1>/gi,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(String(html))) !== null) {
      const fragment = match[3] || match[2] || ''
      if (fragment && fragment.length > 40) fragments.push(fragment)
    }
  }
  return fragments
}

export function parseContainerCandidates(html = '', pageUrl = '', query = '', provider = '') {
  const baseHost = hostnameFromUrl(pageUrl)
  const cleanedQuery = cleanCommerceQuery(query)
  const tokens = queryTokens(cleanedQuery)
  const items = []

  for (const fragment of collectContainerFragments(html)) {
    const anchorMatch = fragment.match(/<a([^>]*)href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!anchorMatch) continue
    const url = absolutizeUrl(pageUrl, decodeHtml(anchorMatch[2]))
    const host = hostnameFromUrl(url)
    if (!url || !host || host !== baseHost || !looksSwissDomain(host)) continue
    if (!looksLikeProductUrl(url, cleanedQuery)) continue

    const headingMatch = fragment.match(/<(h1|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/i)
    const heading = decodeHtml(headingMatch?.[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const title = heading || extractAnchorLabel(anchorMatch[1] || '', anchorMatch[3] || '')
    if (!title || title.length < 5) continue

    const titleHitCount = countTokenHits(title, tokens)
    const urlHitCount = countTokenHits(url, tokens)
    if (tokens.length && titleHitCount === 0 && urlHitCount === 0) continue

    const imageCandidates = extractImageCandidates(fragment, pageUrl)
    items.push({
      url,
      title,
      provider,
      image_url: imageCandidates[0] || null,
      inline_price: normalizePrice(extractPriceText(fragment)),
      title_hit_count: titleHitCount,
      url_hit_count: urlHitCount,
      source_kind_hint: 'container',
    })
  }

  return items
}

function tryParseJson(value) {
  try { return JSON.parse(value) } catch { return null }
}

function collectObjects(value, out = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectObjects(entry, out)
    return out
  }
  if (value && typeof value === 'object') {
    out.push(value)
    for (const entry of Object.values(value)) collectObjects(entry, out)
  }
  return out
}

export function parseJsonProductCandidates(html = '', pageUrl = '', query = '', provider = '') {
  const baseHost = hostnameFromUrl(pageUrl)
  const cleanedQuery = cleanCommerceQuery(query)
  const tokens = queryTokens(cleanedQuery)
  const items = []
  const scriptMatches = [...String(html).matchAll(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)]

  for (const match of scriptMatches) {
    const json = tryParseJson(match[1])
    if (!json) continue
    for (const obj of collectObjects(json)) {
      const title = decodeHtml(String(obj.name || obj.title || obj.productName || obj.label || '')).replace(/\s+/g, ' ').trim()
      const rawUrl = obj.url || obj.link || obj.productUrl || obj.href || obj.targetUrl
      const url = absolutizeUrl(pageUrl, rawUrl || '')
      const host = hostnameFromUrl(url)
      if (!title || !url || host !== baseHost || !looksSwissDomain(host)) continue
      if (!looksLikeProductUrl(url, cleanedQuery)) continue

      const titleHitCount = countTokenHits(title, tokens)
      const urlHitCount = countTokenHits(url, tokens)
      if (tokens.length && titleHitCount === 0 && urlHitCount === 0) continue

      const imageRaw = obj.image || obj.imageUrl || obj.thumbnail || obj.picture
      const image_url = Array.isArray(imageRaw) ? absolutizeUrl(pageUrl, imageRaw[0] || '') : absolutizeUrl(pageUrl, imageRaw || '')
      const priceRaw = obj.price ?? obj.offers?.price ?? obj.offers?.lowPrice ?? obj.offer?.price ?? obj.regularPrice ?? obj.salePrice ?? null
      items.push({
        url,
        title,
        provider,
        image_url: image_url || null,
        inline_price: normalizePrice(priceRaw),
        title_hit_count: titleHitCount,
        url_hit_count: urlHitCount,
        source_kind_hint: 'json',
      })
    }
  }

  return items
}

export function parseSearchForms(html = '', baseUrl = '') {
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

export function buildUrlFromForm(form, query) {
  if (!form?.action || !form?.fieldName) return null
  try {
    const url = new URL(form.action)
    url.searchParams.set(form.fieldName, query)
    return url.toString()
  } catch {
    return null
  }
}

export function buildFallbackSearchCandidates(baseUrl = '', query = '') {
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
      `${origin}/listing.xhtml?q=${encoded.replace(/%20/g, '+')}`,
    ]
    return dedupeCandidates(candidates.map(url => ({ url, reason: 'fallback_pattern', method: 'GET' })))
  } catch {
    return []
  }
}
