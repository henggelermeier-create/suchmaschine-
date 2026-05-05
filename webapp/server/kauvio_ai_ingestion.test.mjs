import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractProductFromHtml,
  ingestSearchResults,
  ingestShopUrl,
  normalizeSearchResult,
} from './kauvio_ai_ingestion.mjs';

test('extractProductFromHtml reads JSON-LD product data', () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Test Laptop",
          "brand": { "@type": "Brand", "name": "Lenovo" },
          "description": "Laptop für Schule",
          "image": "https://shop.ch/laptop.jpg",
          "offers": {
            "@type": "Offer",
            "price": "649",
            "priceCurrency": "CHF",
            "availability": "https://schema.org/InStock"
          }
        }
      </script>
    </head></html>
  `;

  const product = extractProductFromHtml({ url: 'https://shop.ch/laptop', html });

  assert.equal(product.title, 'Test Laptop');
  assert.equal(product.brand, 'Lenovo');
  assert.equal(product.price, '649');
  assert.equal(product.currency, 'CHF');
  assert.equal(product.merchant, 'shop.ch');
});

test('normalizeSearchResult converts a search result into a product candidate', () => {
  const product = normalizeSearchResult({
    title: 'Kaffeemaschine Angebot',
    snippet: 'Gute Kaffeemaschine unter 300 CHF',
    url: 'https://coffee.ch/p/1',
    price: 249,
  });

  assert.equal(product.title, 'Kaffeemaschine Angebot');
  assert.equal(product.domain, 'coffee.ch');
  assert.equal(product.price, 249);
  assert.equal(product.raw_source, 'search_result');
});

test('ingestSearchResults normalizes and stores search results', async () => {
  const stored = [];
  const products = await ingestSearchResults({
    results: [
      { title: 'Produkt 1', url: 'https://shop.ch/1' },
      { title: 'Produkt 2', url: 'https://shop.ch/2' },
    ],
    storeProduct: async (product) => stored.push(product),
  });

  assert.equal(products.length, 2);
  assert.equal(stored.length, 2);
});

test('ingestShopUrl fetches HTML and stores extracted product', async () => {
  const stored = [];
  const fetcher = async () => ({
    ok: true,
    status: 200,
    async text() {
      return '<html><head><title>Shop Product</title><meta property="product:price:amount" content="199"></head></html>';
    },
  });

  const product = await ingestShopUrl({
    url: 'https://shop.ch/product',
    fetcher,
    storeProduct: async (item) => stored.push(item),
    logger: { info() {} },
  });

  assert.equal(product.title, 'Shop Product');
  assert.equal(product.price, '199');
  assert.equal(stored.length, 1);
});
