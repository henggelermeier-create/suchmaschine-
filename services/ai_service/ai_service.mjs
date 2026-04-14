import express from 'express'

const app = express()
app.use(express.json({ limit: '3mb' }))

const PORT = Number(process.env.PORT || 3010)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function decodeHtml(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function hostnameFromUrl(url = '') {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
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

function brandFromTitle(title = '') {
  return clean(title).split(/\s+/)[0] || null
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

function canonicalModelKey({ brand = '', title = '', specs = '' } = {}) {
  return normalizeSearchText(`${brand} ${title} ${specs}`)
    .replace(/\b(5g|lte|wifi|bluetooth|dual sim|esim|smartphone|notebook|headphones|kopfhorer|kopfhörer|black|white|blue|green|gray|grey|silver|gold)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getMeta(html = '', selectors = []) {
  for (const selector of selectors) {
    const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${selector}["'][^>]+content=["']([^"']+)["']`, 'i')
    const match = html.match(regex)
    if (match?.[1]) return decodeHtml(match[1])
  }
  return null
}

function getTitleTag(html = '') {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match?.[1] ? decodeHtml(match[1]) : null
}

function safeJsonParse(value) {
  try { return JSON.parse(value) } catch { return null }
}

function flattenJsonLd(node) {
  if (!node) return []
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd)
  if (Array.isArray(node['@graph'])) return flattenJsonLd(node['@graph'])
  return [node]
}

function extractJsonLdCandidates(html = '') {
  const matches = [...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const out = []
  for (const match of matches) {
    const parsed = safeJsonParse(match[1])
    if (!parsed) continue
    out.push(...flattenJsonLd(parsed))
  }
  return out
}

function extractVisibleText(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseProductFromJsonLd(html = '', pageUrl = '') {
  const blocks = extractJsonLdCandidates(html)
  for (const block of blocks) {
    const typeValue = Array.isArray(block['@type']) ? block['@type'].join(' ') : String(block['@type'] || '')
    if (!/Product/i.test(typeValue)) continue
    const offerNode = Array.isArray(block.offers) ? block.offers[0] : block.offers || {}
    const imageNode = Array.isArray(block.image) ? block.image[0] : block.image
    const brandNode = typeof block.brand === 'object' ? block.brand?.name : block.brand
    const price = normalizePrice(offerNode?.price || offerNode?.priceSpecification?.price)
    return {
      title: clean(block.name || getTitleTag(html) || ''),
      brand: clean(brandNode || brandFromTitle(block.name || '')),
      image_url: typeof imageNode === 'string' ? imageNode : null,
      price,
      currency: offerNode?.priceCurrency || 'CHF',
      availability: clean(offerNode?.availability || ''),
      mpn: clean(block.mpn || ''),
      ean_gtin: clean(block.gtin13 || block.gtin || ''),
      extraction_method: 'json_ld_product',
      confidence_score: price ? 0.94 : 0.82,
      source_product_url: pageUrl,
      deeplink_url: pageUrl,
    }
  }
  return null
}

function parseProductFromMeta(html = '', pageUrl = '') {
  const title = getMeta(html, ['og:title', 'twitter:title']) || getTitleTag(html)
  const image = getMeta(html, ['og:image', 'twitter:image'])
  const priceRaw = getMeta(html, ['product:price:amount', 'og:price:amount']) || (html.match(/CHF\s?[0-9'.,]+/i)?.[0] || null)
  const price = normalizePrice(priceRaw)
  if (!title && !price) return null
  return {
    title: clean(title || ''),
    brand: brandFromTitle(title || ''),
    image_url: image || null,
    price,
    currency: 'CHF',
    availability: null,
    mpn: null,
    ean_gtin: null,
    extraction_method: 'meta_fallback',
    confidence_score: price && image ? 0.74 : 0.62,
    source_product_url: pageUrl,
    deeplink_url: pageUrl,
  }
}

function parseProductFromVisibleText(html = '', pageUrl = '') {
  const visible = extractVisibleText(html)
  const title = clean(getTitleTag(html) || visible.slice(0, 140))
  const price = normalizePrice(visible.match(/CHF\s?[0-9'.,]{2,20}/i)?.[0] || null)
  if (!title || !price) return null
  return {
    title,
    brand: brandFromTitle(title),
    image_url: getMeta(html, ['og:image']) || null,
    price,
    currency: 'CHF',
    availability: null,
    mpn: null,
    ean_gtin: null,
    extraction_method: 'visible_text_fallback',
    confidence_score: 0.56,
    source_product_url: pageUrl,
    deeplink_url: pageUrl,
  }
}

async function callOpenAIJson({ schemaName, schema, instructions, payload }) {
  if (!OPENAI_API_KEY) return null
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      input: [
        { role: 'system', content: instructions },
        { role: 'user', content: `Return strict JSON only. Payload JSON:\n${JSON.stringify(payload)}` },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = await res.json()
  const maybe = data.output_text
    || data.output?.flatMap((item) => item.content || []).find((part) => part.text)?.text
    || data.output?.[0]?.content?.[0]?.text
  if (!maybe) return null
  return JSON.parse(maybe)
}

function finalizeProduct(raw = {}, pageUrl = '') {
  const title = clean(raw.title || '')
  const brand = clean(raw.brand || brandFromTitle(title) || '') || null
  const price = normalizePrice(raw.price)
  return {
    title,
    brand,
    category: clean(raw.category || '') || null,
    image_url: raw.image_url || null,
    price,
    currency: clean(raw.currency || 'CHF') || 'CHF',
    availability: clean(raw.availability || '') || null,
    mpn: clean(raw.mpn || '') || null,
    ean_gtin: clean(raw.ean_gtin || '') || null,
    extraction_method: raw.extraction_method || 'ai_extract',
    confidence_score: Number(raw.confidence_score || 0.7),
    source_product_url: raw.source_product_url || pageUrl || null,
    deeplink_url: raw.deeplink_url || pageUrl || null,
    model_key: canonicalModelKey({ brand, title, specs: [raw.mpn, raw.ean_gtin].filter(Boolean).join(' ') }),
  }
}

async function extractProduct({ html = '', url = '', query = '', source = '' }) {
  const heuristic = parseProductFromJsonLd(html, url) || parseProductFromMeta(html, url) || parseProductFromVisibleText(html, url)
  const visible = extractVisibleText(html).slice(0, 12000)

  const payload = {
    url,
    host: hostnameFromUrl(url),
    query,
    source,
    heuristic,
    html_excerpt: html.slice(0, 16000),
    visible_text_excerpt: visible,
  }

  const ai = await callOpenAIJson({
    schemaName: 'product_extract',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'brand', 'price', 'currency', 'availability', 'image_url', 'mpn', 'ean_gtin', 'category', 'confidence_score'],
      properties: {
        title: { type: 'string' },
        brand: { type: 'string' },
        price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        currency: { type: 'string' },
        availability: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        image_url: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        mpn: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        ean_gtin: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        category: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        confidence_score: { type: 'number' },
      },
    },
    instructions: 'You extract ecommerce product pages into strict JSON. Prefer the heuristic values when they look valid. Infer only from provided content. Return JSON.',
    payload,
  }).catch(() => null)

  const extracted = finalizeProduct(ai || heuristic || {}, url)
  return {
    ok: Boolean(extracted.title),
    extraction: extracted,
    used_ai: Boolean(ai),
    heuristic_found: Boolean(heuristic),
  }
}

function tokenSet(value = '') {
  return new Set(normalizeSearchText(value).split(' ').filter(Boolean))
}

function similarity(a = '', b = '') {
  const sa = tokenSet(a)
  const sb = tokenSet(b)
  if (!sa.size || !sb.size) return 0
  let inter = 0
  for (const token of sa) if (sb.has(token)) inter += 1
  const union = new Set([...sa, ...sb]).size || 1
  return inter / union
}

async function matchProducts({ primary, candidates = [] }) {
  const normPrimary = finalizeProduct(primary || {})
  const scored = candidates.map((candidate) => {
    const norm = finalizeProduct(candidate || {})
    const hardMatch = Boolean(normPrimary.ean_gtin && norm.ean_gtin && normPrimary.ean_gtin === norm.ean_gtin)
      || Boolean(normPrimary.mpn && norm.mpn && normPrimary.mpn === norm.mpn)
      || Boolean(normPrimary.model_key && norm.model_key && normPrimary.model_key === norm.model_key)
    const score = hardMatch ? 0.98 : similarity(`${normPrimary.brand} ${normPrimary.title}`, `${norm.brand} ${norm.title}`)
    return { ...norm, score, hardMatch }
  })

  if (OPENAI_API_KEY && scored.length) {
    const ai = await callOpenAIJson({
      schemaName: 'product_match',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['matches'],
        properties: {
          matches: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['index', 'score', 'is_same_product'],
              properties: {
                index: { type: 'integer' },
                score: { type: 'number' },
                is_same_product: { type: 'boolean' },
              },
            },
          },
        },
      },
      instructions: 'Compare one primary product with candidate offers. Return which candidates are the same underlying product. Prefer exact storage, model, MPN, EAN and brand consistency.',
      payload: {
        primary: normPrimary,
        candidates: scored.map((item, index) => ({ index, ...item })),
      },
    }).catch(() => null)
    if (ai?.matches?.length) {
      return ai.matches
        .filter((item) => item.is_same_product)
        .map((item) => ({ ...scored[item.index], score: item.score, ai_match: true }))
        .sort((a, b) => b.score - a.score)
    }
  }

  return scored.filter((item) => item.score >= 0.78).sort((a, b) => b.score - a.score)
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ai_service', model: AI_MODEL, openaiEnabled: Boolean(OPENAI_API_KEY) })
})

app.post('/evaluate', (req, res) => {
  const score = Number(req.body?.deal_score || 0)
  const evaluation = score >= 88 ? { label: 'Jetzt kaufen', verdict: 'buy' } : score >= 78 ? { label: 'Guter Kauf', verdict: 'consider' } : { label: 'Beobachten', verdict: 'watch' }
  res.json({ ok: true, evaluation })
})

app.post('/extract', async (req, res) => {
  try {
    const result = await extractProduct(req.body || {})
    res.json(result)
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) })
  }
})

app.post('/match', async (req, res) => {
  try {
    const matches = await matchProducts(req.body || {})
    res.json({ ok: true, matches })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) })
  }
})

app.listen(PORT, () => console.log(`ai service on ${PORT}`))
