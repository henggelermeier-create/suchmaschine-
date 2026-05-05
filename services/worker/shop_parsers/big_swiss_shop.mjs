import { cleanCommerceQuery, queryTokens, countTokenHits, absolutizeUrl, normalizePrice, extractImageCandidates, extractPriceText, extractAnchorLabel, rankCandidates, looksLikeProductUrl } from './shared.mjs'

function textFromHtml(fragment = '') {
  return String(fragment || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function blockAround(html = '', index = 0) {
  return String(html || '').slice(Math.max(0, index - 1400), Math.min(String(html || '').length, index + 2200))
}

function findNearbyPrice(fragment = '') {
  return normalizePrice(extractPriceText(fragment) || fragment.match(/(?:price|salesPrice|currentPrice)[^0-9]{0,30}([0-9][0-9'.,]{1,16})/i)?.[1] || null)
}

export function parseBigSwissShopCards(html = '', pageUrl = '', query = '', provider = '') {
  const cleanedQuery = cleanCommerceQuery(query)
  const tokens = queryTokens(cleanedQuery)
  const items = []
  const source = String(html || '').replace(/\\u002F/g, '/').replace(/\\\//g, '/')
  const linkPattern = /<a([^>]*)href=["']([^"']+)["'][^>]*>([\s\S]{0,2500}?)<\/a>/gi
  let match
  while ((match = linkPattern.exec(source)) !== null && items.length < 80) {
    const url = absolutizeUrl(pageUrl, match[2])
    if (!url || !looksLikeProductUrl(url, cleanedQuery)) continue
    const block = blockAround(source, match.index)
    const label = extractAnchorLabel(match[1] || '', match[3] || '') || textFromHtml(match[3] || block)
    const title = label.replace(/CHF\s?[0-9'.,]+/i, '').replace(/\s+/g, ' ').trim()
    if (!title || title.length < 5 || title.length > 220) continue
    const titleHitCount = countTokenHits(title, tokens)
    const urlHitCount = countTokenHits(url, tokens)
    if (tokens.length && titleHitCount === 0 && urlHitCount === 0) continue
    items.push({
      url,
      title,
      provider,
      image_url: extractImageCandidates(block, pageUrl)[0] || null,
      inline_price: findNearbyPrice(block),
      title_hit_count: titleHitCount,
      url_hit_count: urlHitCount,
      source_kind_hint: 'big_swiss_shop',
    })
  }
  return rankCandidates(items)
}
