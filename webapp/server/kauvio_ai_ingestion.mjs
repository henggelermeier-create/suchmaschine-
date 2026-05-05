const PRODUCT_HINT_SELECTORS = [
  'script[type="application/ld+json"]',
  'meta[property="og:title"]',
  'meta[property="product:price:amount"]',
  'meta[name="description"]',
];

function sanitizeText(value, maxLength = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeUrl(value, base) {
  try {
    return value ? new URL(value, base).toString() : null;
  } catch {
    return null;
  }
}

function getDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = String(html).match(pattern);
    if (match?.[1]) return sanitizeText(match[1], 500);
  }
  return null;
}

function extractJsonLd(html) {
  const blocks = [...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const parsed = [];

  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1].trim());
      if (Array.isArray(value)) parsed.push(...value);
      else parsed.push(value);
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return parsed.flatMap((entry) => {
    if (entry?.['@graph'] && Array.isArray(entry['@graph'])) return entry['@graph'];
    return [entry];
  });
}

function findProductJsonLd(entries = []) {
  return entries.find((entry) => {
    const type = entry?.['@type'];
    if (Array.isArray(type)) return type.map(String).some((item) => item.toLowerCase() === 'product');
    return String(type ?? '').toLowerCase() === 'product';
  }) ?? null;
}

function normalizeOffer(offer) {
  const firstOffer = Array.isArray(offer) ? offer[0] : offer;
  if (!firstOffer || typeof firstOffer !== 'object') return {};
  return {
    price: firstOffer.price ?? firstOffer.lowPrice ?? firstOffer.highPrice ?? null,
    currency: firstOffer.priceCurrency ?? firstOffer.currency ?? 'CHF',
    availability: firstOffer.availability ?? null,
    url: firstOffer.url ?? null,
  };
}

export function extractProductFromHtml({ url, html }) {
  const jsonLdProduct = findProductJsonLd(extractJsonLd(html));
  const offer = normalizeOffer(jsonLdProduct?.offers);
  const title = sanitizeText(
    jsonLdProduct?.name
    ?? extractMeta(html, 'og:title')
    ?? String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?? '',
    300
  );
  const description = sanitizeText(
    jsonLdProduct?.description
    ?? extractMeta(html, 'description')
    ?? extractMeta(html, 'og:description')
    ?? stripHtml(html).slice(0, 500),
    1000
  );
  const image = Array.isArray(jsonLdProduct?.image) ? jsonLdProduct.image[0] : jsonLdProduct?.image ?? extractMeta(html, 'og:image');
  const price = offer.price ?? extractMeta(html, 'product:price:amount');
  const currency = offer.currency ?? extractMeta(html, 'product:price:currency') ?? 'CHF';

  return {
    title,
    description,
    brand: typeof jsonLdProduct?.brand === 'object' ? jsonLdProduct.brand.name : jsonLdProduct?.brand ?? null,
    price,
    currency,
    availability: offer.availability,
    image: safeUrl(image, url),
    url: offer.url ? safeUrl(offer.url, url) : url,
    merchant: getDomain(url),
    domain: getDomain(url),
    raw_source: 'html_jsonld_meta',
  };
}

export function normalizeIngestedProduct(product = {}) {
  const url = safeUrl(product.url ?? product.product_url ?? product.canonical_url);
  return {
    title: sanitizeText(product.title ?? product.name ?? product.product_title, 300),
    brand: sanitizeText(product.brand, 120) || null,
    category: sanitizeText(product.category, 120) || null,
    price: product.price ?? product.current_price ?? null,
    currency: sanitizeText(product.currency ?? 'CHF', 10) || 'CHF',
    merchant: sanitizeText(product.merchant ?? product.shop ?? product.domain ?? getDomain(url), 200) || null,
    url,
    image: safeUrl(product.image ?? product.image_url, url),
    description: sanitizeText(product.description ?? product.summary, 1000),
    availability: sanitizeText(product.availability ?? product.stock_status, 200) || null,
    domain: getDomain(url),
    raw_source: product.raw_source ?? 'normalized_ingestion',
  };
}

export async function ingestShopUrl({ url, fetcher = fetch, storeProduct, logger = console } = {}) {
  if (!url) throw new Error('ingestShopUrl requires url.');

  const response = await fetcher(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'KauvioBot/1.0 (+https://kauvio.ch)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to ingest ${url}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const product = normalizeIngestedProduct(extractProductFromHtml({ url, html }));

  if (storeProduct) {
    await storeProduct(product);
  }

  logger.info?.('Kauvio ingested shop URL.', { url, title: product.title, domain: product.domain });
  return product;
}

export function normalizeSearchResult(result = {}) {
  return normalizeIngestedProduct({
    title: result.title ?? result.name,
    description: result.snippet ?? result.description ?? result.summary,
    url: result.url ?? result.link,
    image: result.image ?? result.thumbnail,
    price: result.price,
    currency: result.currency ?? 'CHF',
    merchant: result.merchant ?? result.source ?? getDomain(result.url ?? result.link),
    raw_source: 'search_result',
  });
}

export async function ingestSearchResults({ results = [], storeProduct } = {}) {
  const normalized = results.map(normalizeSearchResult).filter((item) => item.url || item.title);

  if (storeProduct) {
    for (const product of normalized) {
      await storeProduct(product);
    }
  }

  return normalized;
}

export { PRODUCT_HINT_SELECTORS };

export default {
  extractProductFromHtml,
  normalizeIngestedProduct,
  ingestShopUrl,
  normalizeSearchResult,
  ingestSearchResults,
};
