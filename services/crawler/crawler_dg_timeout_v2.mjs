import https from 'node:https'
import { Pool } from 'pg'
import { JSDOM } from 'jsdom'
import { ensureCoreSchema } from '../../database/ensure_schema.mjs'
import { normalizeDbUrl } from '../../database/normalize_db_url.mjs'

const DATABASE_URL = normalizeDbUrl(process.env.DATABASE_URL)
const pool = new Pool({ connectionString: DATABASE_URL })
const FETCH_TIMEOUT_MS = Number(process.env.CRAWLER_FETCH_TIMEOUT_MS || 90000)
const LIMIT = Number(process.env.IMPORT_LIMIT_PER_PAGE || 36)
const FAST_INTERVAL = Number(process.env.FAST_CRAWLER_INTERVAL_SECONDS || 600)
const FULL_INTERVAL = Number(process.env.FULL_CRAWLER_INTERVAL_SECONDS || 3600)
const AUTO_START_FAST = process.env.CRAWLER_AUTO_START_FAST !== 'false'
const AUTO_START_FULL = process.env.CRAWLER_AUTO_START_FULL !== 'false'
const MAX_SITEMAPS = Number(process.env.CRAWLER_SITEMAP_MAX_FILES || 8)
const URL_BATCH_MULTIPLIER = Number(process.env.CRAWLER_URL_BATCH_MULTIPLIER || 3)

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Upgrade-Insecure-Requests': '1'
}

const DIGITEC_PRODUCT_RE = /(?:digitec|galaxus)\.ch\/.+\/(?:product|s1\/product)\//i
const TITLE_BRAND_RE = /(Apple|Samsung|Google|Xiaomi|Sony|Nokia|Motorola|Asus|Lenovo|HP|Acer|Dell|MSI|Jabra|Bose|Nothing|Honor|Huawei|Fairphone|Microsoft|DJI|Roborock|Philips|Logitech|Intel|Panasonic|Ecovacs|Dyson|Bambu|Sonos|Corsair)/i

const sources = {
  digitec: {
    shop_name: 'Digitec',
    urls: String(process.env.DIGITEC_IMPORT_URLS || 'https://www.digitec.ch/sitemap/v2/products-sitemap.xml')
      .split(',').map(x => x.trim()).filter(Boolean)
  },
  galaxus: {
    shop_name: 'Galaxus',
    urls: String(process.env.GALAXUS_IMPORT_URLS || 'https://www.galaxus.ch/sitemap/v2/products-sitemap.xml')
      .split(',').map(x => x.trim()).filter(Boolean)
  }
}

function clean(s = '') {
  return String(s).replace(/\s+/g, ' ').trim()
}

function brandFromTitle(title = '') {
  return clean(title).split(/\s+/)[0] || null
}

function slugify(input = '') {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 160)
}

function normalizePrice(raw) {
  const cleaned = String(raw || '')
    .replace(/CHF/gi, '')
    .replace(/–/g, '')
    .replace(/'/g, '')
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

function categoryFromUrl(url) {
  if (/smartphones?/i.test(url)) return 'Smartphones'
  if (/notebook/i.test(url)) return 'Notebooks'
  if (/headphones?|kopfhoerer|kopfhörer/i.test(url)) return 'Headphones'
  if (/staubsauger/i.test(url)) return 'Staubsauger'
  return 'Produkte'
}

function maybeAbsolute(base, href) {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

function buildSlug(title, brand) {
  return slugify(`${brand || brandFromTitle(title) || ''} ${title}`)
}

function extractImageUrlFromElement(el) {
  if (!el) return null
  const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || ''
  const firstSrcset = srcset.split(',')[0]?.trim()?.split(' ')[0] || null
  const direct = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-image') || null
  return direct || firstSrcset || null
}

function extractXmlLocs(xml = '') {
  return [...String(xml).matchAll(/<loc>(.*?)<\/loc>/gi)]
    .map((m) => clean(m[1]))
    .filter(Boolean)
}

function isSitemapUrl(url = '') {
  return /\.xml(\?.*)?$/i.test(String(url))
}

function networkErrorMessage(url, primaryError, fallbackError) {
  const bits = []
  const pushErr = (label, err) => {
    if (!err) return
    const causeCode = err?.cause?.code ? ` cause=${err.cause.code}` : ''
    const causeMsg = err?.cause?.message ? ` cause_msg=${err.cause.message}` : ''
    bits.push(`${label}: ${err.name || 'Error'} ${err.message || String(err)}${causeCode}${causeMsg}`)
  }
  pushErr('fetch', primaryError)
  pushErr('https', fallbackError)
  return `Network request failed for ${url} | ${bits.join(' | ')}`
}

function requestViaHttps(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      family: 4,
      timeout: FETCH_TIMEOUT_MS,
    }, (res) => {
      if (!res.statusCode || res.statusCode >= 400) {
        res.resume()
        return reject(new Error(`HTTPS HTTP ${res.statusCode || 'unknown'} for ${url}`))
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve(body))
    })
    req.on('timeout', () => req.destroy(new Error(`HTTPS timeout after ${FETCH_TIMEOUT_MS}ms for ${url}`)))
    req.on('error', reject)
    req.end()
  })
}

async function fetchText(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const text = await res.text()
      clearTimeout(timeout)
      return text
    } catch (fetchErr) {
      clearTimeout(timeout)
      let httpsErr = null
      try {
        return await requestViaHttps(url)
      } catch (fallbackErr) {
        httpsErr = fallbackErr
      }
      lastError = new Error(networkErrorMessage(url, fetchErr, httpsErr))
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  throw lastError
}

async function collectProductUrlsFromSitemap(seedUrl, limit) {
  const productUrls = []
  const sitemapQueue = [seedUrl]
  const seenSitemaps = new Set()
  const seenProducts = new Set()
  const wanted = Math.max(limit * URL_BATCH_MULTIPLIER, limit)
  let processed = 0

  while (sitemapQueue.length && productUrls.length < wanted && processed < MAX_SITEMAPS) {
    const sitemapUrl = sitemapQueue.shift()
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue
    seenSitemaps.add(sitemapUrl)
    processed += 1
    const xml = await fetchText(sitemapUrl)
    const locs = extractXmlLocs(xml)
    for (const loc of locs) {
      if (isSitemapUrl(loc)) {
        if (!seenSitemaps.has(loc)) sitemapQueue.push(loc)
        continue
      }
      if (!DIGITEC_PRODUCT_RE.test(loc)) continue
      if (seenProducts.has(loc)) continue
      seenProducts.add(loc)
      productUrls.push(loc)
      if (productUrls.length >= wanted) break
    }
  }
  return productUrls
}

async function collectProductUrlsFromCategory(seedUrl, limit) {
  const html = await fetchText(seedUrl)
  const dom = new JSDOM(html)
  const urls = []
  const seen = new Set()
  for (const a of dom.window.document.querySelectorAll('a[href]')) {
    const href = maybeAbsolute(seedUrl, a.getAttribute('href'))
    if (!href || !DIGITEC_PRODUCT_RE.test(href) || seen.has(href)) continue
    seen.add(href)
    urls.push(href)
    if (urls.length >= Math.max(limit * URL_BATCH_MULTIPLIER, limit)) break
  }
  return urls
}

async function collectSeedProductUrls(seedUrl, limit) {
  if (isSitemapUrl(seedUrl)) return collectProductUrlsFromSitemap(seedUrl, limit)
  return collectProductUrlsFromCategory(seedUrl, limit)
}

function findFirstPrice(lines, aroundIndex = 0) {
  const start = Math.max(0, aroundIndex - 4)
  const end = Math.min(lines.length - 1, aroundIndex + 8)
  for (let i = start; i <= end; i++) {
    const price = normalizePrice(lines[i])
    if (price) return price
  }
  for (const line of lines) {
    const price = normalizePrice(line)
    if (price) return price
  }
  return null
}

function findSpecsAfterTitle(lines, titleIndex) {
  for (let i = titleIndex + 1; i <= Math.min(lines.length - 1, titleIndex + 4); i++) {
    const candidate = clean(lines[i])
    if (!candidate) continue
    if (/^CHF\s*\d/i.test(candidate)) continue
    if (candidate === lines[titleIndex]) continue
    if (candidate.length > 160) continue
    return candidate
  }
  return ''
}

function stripSiteSuffix(title = '') {
  return clean(String(title).replace(/\s*-\s*(Digitec|Galaxus).*$/i, ''))
}

function buildItem({ title, specs = '', productUrl, price, image_url, source_name, shop_name }) {
  const cleanTitle = clean(title)
  if (!cleanTitle || !TITLE_BRAND_RE.test(cleanTitle) || !price) return null
  const full = clean(`${cleanTitle} ${specs}`)
  const brand = brandFromTitle(cleanTitle)
  return {
    slug: buildSlug(full, brand),
    title: full,
    brand,
    category: categoryFromUrl(productUrl),
    description: `Live import von ${shop_name}`,
    price,
    currency: 'CHF',
    price_level: `Live bei ${shop_name}`,
    deal_score: 60,
    ai_summary: `Aktueller Live-Preisimport von ${shop_name}.`,
    shop_name,
    product_url: productUrl || null,
    image_url: image_url || null,
    source_name,
    source_external_id: null,
  }
}

function parseProductPage(html, productUrl, source_name, shop_name) {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const lines = String(document.body?.textContent || html).split(/\n+/).map(clean).filter(Boolean)
  const h1 = clean(document.querySelector('h1')?.textContent || '')
  const metaTitle = stripSiteSuffix(document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title || '')
  const title = h1 || metaTitle
  const titleIndex = lines.findIndex((line) => line === title || line.includes(title))
  const specs = titleIndex >= 0 ? findSpecsAfterTitle(lines, titleIndex) : ''
  const price = findFirstPrice(lines, titleIndex >= 0 ? titleIndex : 0)
  const image_url = document.querySelector('meta[property="og:image"]')?.getAttribute('content')
    || extractImageUrlFromElement(document.querySelector('img[alt^="Produktbild"]'))
    || extractImageUrlFromElement(document.querySelector('img[alt^="Image: Produktbild"]'))
    || null
  return buildItem({ title, specs, productUrl, price, image_url, source_name, shop_name })
}

function dedupe(items) {
  const map = new Map()
  for (const item of items) {
    if (!item?.slug || !item?.price) continue
    const prev = map.get(item.slug)
    if (!prev || item.price < prev.price) map.set(item.slug, item)
  }
  return [...map.values()]
}

async function importSourceSeed(seedUrl, source_name, shop_name, limit) {
  const productUrls = await collectSeedProductUrls(seedUrl, limit)
  const items = []
  for (const productUrl of productUrls) {
    try {
      const html = await fetchText(productUrl, 2)
      const item = parseProductPage(html, productUrl, source_name, shop_name)
      if (item) items.push(item)
      if (items.length >= limit) break
    } catch (err) {
      console.error(`[crawler] ${source_name} product fetch failed for ${productUrl}`, err)
    }
  }
  return dedupe(items).slice(0, limit)
}

async function upsertProduct(item) {
  await pool.query(`
    INSERT INTO products (slug,title,brand,category,description,price,currency,price_level,deal_score,ai_summary,shop_name,product_url,image_url,source_name,source_external_id,updated_at,last_seen_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
    ON CONFLICT (slug) DO UPDATE SET
      title=EXCLUDED.title,
      brand=COALESCE(EXCLUDED.brand,products.brand),
      category=COALESCE(EXCLUDED.category,products.category),
      description=COALESCE(EXCLUDED.description,products.description),
      price=LEAST(COALESCE(products.price,EXCLUDED.price),EXCLUDED.price),
      currency=EXCLUDED.currency,
      price_level=EXCLUDED.price_level,
      deal_score=GREATEST(COALESCE(products.deal_score,0),EXCLUDED.deal_score),
      ai_summary=EXCLUDED.ai_summary,
      shop_name=EXCLUDED.shop_name,
      product_url=COALESCE(EXCLUDED.product_url,products.product_url),
      image_url=COALESCE(EXCLUDED.image_url,products.image_url),
      source_name=EXCLUDED.source_name,
      source_external_id=COALESCE(EXCLUDED.source_external_id,products.source_external_id),
      updated_at=NOW(),
      last_seen_at=NOW()
  `, [item.slug, item.title, item.brand, item.category, item.description, item.price, item.currency, item.price_level, item.deal_score, item.ai_summary, item.shop_name, item.product_url, item.image_url, item.source_name, item.source_external_id])

  await pool.query(`
    INSERT INTO product_offers (product_slug,shop_name,price,currency,product_url,image_url,source_name,updated_at,last_seen_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
    ON CONFLICT (product_slug, shop_name) DO UPDATE SET
      price=EXCLUDED.price,
      currency=EXCLUDED.currency,
      product_url=COALESCE(EXCLUDED.product_url,product_offers.product_url),
      image_url=COALESCE(EXCLUDED.image_url,product_offers.image_url),
      source_name=EXCLUDED.source_name,
      updated_at=NOW(),
      last_seen_at=NOW()
  `, [item.slug, item.shop_name, item.price, item.currency, item.product_url, item.image_url, item.source_name])
}

async function refreshCanonicalPricing() {
  await pool.query(`
    UPDATE products p
    SET price=x.min_price,currency=x.currency,shop_name=x.shop_name,product_url=x.product_url,updated_at=NOW()
    FROM (
      SELECT DISTINCT ON (o.product_slug)
        o.product_slug,o.price AS min_price,o.currency,o.shop_name,o.product_url
      FROM product_offers o
      ORDER BY o.product_slug,o.price ASC,o.updated_at DESC
    ) x
    WHERE p.slug=x.product_slug
  `)
}

async function runSource(source_name, mode = 'fast') {
  const source = sources[source_name]
  let itemsFound = 0
  let itemsWritten = 0
  let errors = 0
  const modeLimit = mode === 'full' ? Math.max(LIMIT * 3, LIMIT) : LIMIT

  for (const url of source.urls) {
    try {
      const items = await importSourceSeed(url, source_name, source.shop_name, modeLimit)
      itemsFound += items.length
      console.log(`[crawler] ${source_name} ${mode} ${url} -> ${items.length} products`)
      for (const item of items) {
        await upsertProduct(item)
        itemsWritten += 1
      }
    } catch (err) {
      errors += 1
      console.error(`[crawler] ${source_name} import failed for ${url}`, err)
    }
  }

  await refreshCanonicalPricing()
  await pool.query(
    'INSERT INTO crawler_runs(source_name,status,items_found,items_written,error_message) VALUES ($1,$2,$3,$4,$5)',
    [`${source_name}-${mode}`, itemsWritten > 0 ? 'success' : 'failed', itemsFound, itemsWritten, itemsWritten > 0 ? null : `No products imported (${errors} source errors)`]
  ).catch(() => {})
  console.log(`[crawler] ${source_name} ${mode} done ${itemsWritten}/${itemsFound}`)
}

async function processManualJobs() {
  const result = await pool.query(`SELECT id, source_name, mode FROM crawl_jobs WHERE status='pending' ORDER BY requested_at ASC LIMIT 5`).catch(() => ({ rows: [] }))
  for (const job of result.rows) {
    const claimed = await pool.query(`UPDATE crawl_jobs SET status='running', started_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,source_name,mode`, [job.id]).catch(() => ({ rows: [] }))
    if (!claimed.rows.length) continue
    const { source_name, mode } = claimed.rows[0]
    try {
      if (source_name === 'all') {
        await runSource('digitec', mode)
        await runSource('galaxus', mode)
      } else if (source_name === 'digitec' || source_name === 'galaxus') {
        await runSource(source_name, mode)
      }
      await pool.query(`UPDATE crawl_jobs SET status='success', finished_at=NOW() WHERE id=$1`, [job.id]).catch(() => {})
      console.log(`[crawler] manual job ok ${source_name} ${mode}`)
    } catch (err) {
      await pool.query(`UPDATE crawl_jobs SET status='failed', finished_at=NOW(), error_message=$2 WHERE id=$1`, [job.id, String(err.message || err)]).catch(() => {})
    }
  }
}

async function start() {
  await ensureCoreSchema(pool)
  console.log(`[crawler] fetch timeout is ${FETCH_TIMEOUT_MS}ms`)
  console.log(`[crawler] auto fast ${AUTO_START_FAST ? 'enabled' : 'disabled'} · auto full ${AUTO_START_FULL ? 'enabled' : 'disabled'}`)
  if (AUTO_START_FAST) {
    setTimeout(() => { runSource('digitec', 'fast').catch(console.error); runSource('galaxus', 'fast').catch(console.error) }, 5000)
    setInterval(() => { runSource('digitec', 'fast').catch(console.error); runSource('galaxus', 'fast').catch(console.error) }, FAST_INTERVAL * 1000)
  }
  if (AUTO_START_FULL) {
    setTimeout(() => { runSource('digitec', 'full').catch(console.error); runSource('galaxus', 'full').catch(console.error) }, 15000)
    setInterval(() => { runSource('digitec', 'full').catch(console.error); runSource('galaxus', 'full').catch(console.error) }, FULL_INTERVAL * 1000)
  }
  setInterval(() => { processManualJobs().catch(console.error) }, 15000)
  processManualJobs().catch(console.error)
}

start().catch((err) => {
  console.error('[crawler] startup failed', err)
  process.exit(1)
})
