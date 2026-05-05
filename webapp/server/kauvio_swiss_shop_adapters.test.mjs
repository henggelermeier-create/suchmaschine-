import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectSwissShopAdapter,
  extractWithSwissShopAdapter,
  getSupportedSwissShopAdapters,
  ingestSwissShopUrl,
} from './kauvio_swiss_shop_adapters.mjs';

test('detectSwissShopAdapter detects common Swiss shop domains', () => {
  assert.equal(detectSwissShopAdapter('https://www.digitec.ch/de/s1/product/x').id, 'digitec_galaxus');
  assert.equal(detectSwissShopAdapter('brack.ch').id, 'brack');
  assert.equal(detectSwissShopAdapter('https://www.interdiscount.ch/product/y').id, 'microspot_interdiscount');
});

test('getSupportedSwissShopAdapters exposes configured adapters', () => {
  const adapters = getSupportedSwissShopAdapters();
  assert.ok(adapters.length >= 8);
  assert.ok(adapters.some((adapter) => adapter.id === 'digitec_galaxus'));
});

test('extractWithSwissShopAdapter enriches generic product with adapter data', () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Galaxy Laptop",
          "brand": "Samsung",
          "offers": { "price": "799", "priceCurrency": "CHF" }
        }
      </script>
    </head></html>
  `;

  const product = extractWithSwissShopAdapter({ url: 'https://www.galaxus.ch/product/1', html });

  assert.equal(product.adapter_id, 'digitec_galaxus');
  assert.equal(product.merchant, 'Digitec Galaxus');
  assert.equal(product.title, 'Galaxy Laptop');
  assert.equal(product.price, '799');
});

test('extractWithSwissShopAdapter uses embedded state fallback', () => {
  const html = `
    <html><head>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"product":{"productName":"State Product","brandName":"BrandX","currentPrice":249}}}}
      </script>
    </head></html>
  `;

  const product = extractWithSwissShopAdapter({ url: 'https://www.brack.ch/product/1', html });

  assert.equal(product.adapter_id, 'brack');
  assert.equal(product.title, 'State Product');
  assert.equal(product.brand, 'BrandX');
  assert.equal(product.price, '249');
});

test('ingestSwissShopUrl fetches and stores product', async () => {
  const stored = [];
  const fetcher = async () => ({
    ok: true,
    status: 200,
    async text() {
      return '<html><head><title>Fust Product</title><meta property="product:price:amount" content="399"></head></html>';
    },
  });

  const product = await ingestSwissShopUrl({
    url: 'https://www.fust.ch/product/1',
    fetcher,
    storeProduct: async (item) => stored.push(item),
    logger: { info() {} },
  });

  assert.equal(product.adapter_id, 'fust');
  assert.equal(stored.length, 1);
});
