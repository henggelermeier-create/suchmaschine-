import {
  extractProductFromHtml,
  normalizeIngestedProduct,
} from './kauvio_ai_ingestion.mjs';

const SWISS_SHOP_ADAPTERS = [
  {
    id: 'digitec_galaxus',
    name: 'Digitec Galaxus',
    domains: ['digitec.ch', 'galaxus.ch'],
    categoryHints: ['electronics', 'household', 'computer', 'gaming'],
  },
  {
    id: 'brack',
    name: 'Brack.ch',
    domains: ['brack.ch'],
    categoryHints: ['electronics', 'office', 'household'],
  },
  {
    id: 'microspot_interdiscount',
    name: 'Microspot / Interdiscount',
    domains: ['microspot.ch', 'interdiscount.ch'],
    categoryHints: ['electronics', 'computer', 'home'],
  },
  {
    id: 'melectronics',
    name: 'Melectronics',
    domains: ['melectronics.ch', 'migros.ch'],
    categoryHints: ['electronics', 'household'],
  },
  {
    id: 'coop',
    name: 'Coop',
    domains: ['coop.ch'],
    categoryHints: ['grocery', 'household', 'beauty'],
  },
  {
    id: 'manor',
    name: 'Manor',
    domains: ['manor.ch'],
    categoryHints: ['fashion', 'home', 'beauty'],
  },
  {
    id: 'zalando_ch',
    name: 'Zalando Switzerland',
    domains: ['zalando.ch'],
    categoryHints: ['fashion', 'shoes'],
  },
  {
    id: 'jumbo',
    name: 'Jumbo',
    domains: ['jumbo.ch'],
    categoryHints: ['diy', 'garden', 'tools'],
  },
  {
    id: 'hornbach_ch',
    name: 'Hornbach Switzerland',
    domains: ['hornbach.ch'],
    categoryHints: ['diy', 'garden', 'tools'],
  },
  {
    id: 'fust',
    name: 'Fust',
    domains: ['fust.ch'],
    categoryHints: ['electronics', 'household'],
  },
];

function safeUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function normalizeDomain(value = '') {
  return String(value).toLowerCase().replace(/^www\./, '').trim();
}

function getDomain(url) {
  return normalizeDomain(safeUrl(url)?.hostname ?? '');
}

function sanitizeText(value, maxLength = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
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
    if (match?.[1]) return sanitizeText(match[1]);
  }
  return null;
}

function extractEmbeddedState(html) {
  const candidates = [
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i,
  ];

  for (const pattern of candidates) {
    const match = String(html).match(pattern);
    if (!match?.[1]) continue;
    try {
      return JSON.parse(match[1].trim());
    } catch {
      // Ignore malformed state blocks.
    }
  }
  return null;
}

function findValuesDeep(value, keyNames, results = []) {
  if (!value || typeof value !== 'object') return results;

  if (Array.isArray(value)) {
    for (const item of value) findValuesDeep(item, keyNames, results);
    return results;
  }

  for (const [key, child] of Object.entries(value)) {
    if (keyNames.includes(key) && (typeof child === 'string' || typeof child === 'number')) {
      results.push(child);
    }
    if (child && typeof child === 'object') findValuesDeep(child, keyNames, results);
  }

  return results;
}

function firstUseful(values = []) {
  return values.map((value) => sanitizeText(value)).find((value) => value && value.length > 1) ?? null;
}

export function detectSwissShopAdapter(urlOrDomain) {
  const domain = normalizeDomain(urlOrDomain?.includes?.('://') ? getDomain(urlOrDomain) : urlOrDomain);
  if (!domain) return null;

  return SWISS_SHOP_ADAPTERS.find((adapter) =>
    adapter.domains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
  ) ?? null;
}

export function extractWithSwissShopAdapter({ url, html }) {
  const adapter = detectSwissShopAdapter(url);
  const genericProduct = extractProductFromHtml({ url, html });

  if (!adapter) {
    return normalizeIngestedProduct({
      ...genericProduct,
      adapter_id: null,
    });
  }

  const state = extractEmbeddedState(html);
  const stateTitle = firstUseful(findValuesDeep(state, ['name', 'title', 'productName']));
  const stateBrand = firstUseful(findValuesDeep(state, ['brand', 'brandName', 'manufacturer']));
  const statePrice = firstUseful(findValuesDeep(state, ['price', 'currentPrice', 'salesPrice', 'amount']));
  const stateImage = firstUseful(findValuesDeep(state, ['image', 'imageUrl', 'thumbnail', 'thumbnailUrl']));

  const product = normalizeIngestedProduct({
    ...genericProduct,
    title: stateTitle ?? genericProduct.title,
    brand: stateBrand ?? genericProduct.brand,
    price: statePrice ?? genericProduct.price ?? extractMeta(html, 'product:price:amount'),
    image: stateImage ?? genericProduct.image,
    merchant: adapter.name,
    domain: getDomain(url),
    raw_source: `swiss_shop_adapter:${adapter.id}`,
    adapter_id: adapter.id,
    adapter_name: adapter.name,
    category: genericProduct.category ?? adapter.categoryHints?.[0] ?? null,
  });

  return {
    ...product,
    adapter_id: adapter.id,
    adapter_name: adapter.name,
    category_hints: adapter.categoryHints,
  };
}

export async function ingestSwissShopUrl({ url, fetcher = fetch, storeProduct, logger = console } = {}) {
  if (!url) throw new Error('ingestSwissShopUrl requires url.');

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
  const product = extractWithSwissShopAdapter({ url, html });

  if (storeProduct) await storeProduct(product);
  logger.info?.('Kauvio ingested Swiss shop URL.', {
    url,
    adapter_id: product.adapter_id,
    title: product.title,
  });

  return product;
}

export function getSupportedSwissShopAdapters() {
  return SWISS_SHOP_ADAPTERS.map((adapter) => ({ ...adapter }));
}

export { SWISS_SHOP_ADAPTERS };

export default {
  detectSwissShopAdapter,
  extractWithSwissShopAdapter,
  ingestSwissShopUrl,
  getSupportedSwissShopAdapters,
};
