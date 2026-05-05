const STOP_WORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einen', 'und', 'oder', 'mit', 'ohne', 'für', 'bei', 'von', 'zu',
  'the', 'and', 'with', 'for', 'new', 'neu', 'angebot', 'sale', 'aktion', 'black', 'friday', 'chf',
]);

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß\s.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function jaccard(a = [], b = []) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function extractModelTokens(product = {}) {
  const text = normalizeText([product.title, product.name, product.description].filter(Boolean).join(' '));
  const modelLike = text.match(/\b[a-z]{1,5}[- ]?\d{2,5}[a-z0-9-]*\b/gi) ?? [];
  const storage = text.match(/\b\d+\s?(gb|tb|mah|w|hz|inch|zoll)\b/gi) ?? [];
  const sizes = text.match(/\b\d{2,3}(\.\d)?\s?(cm|mm|inch|zoll)\b/gi) ?? [];
  return unique([...modelLike, ...storage, ...sizes].map(normalizeText));
}

function normalizeBrand(product = {}) {
  return normalizeText(product.brand ?? product.manufacturer ?? '').replace(/[^a-z0-9äöüß]/g, '');
}

function normalizeCategory(product = {}) {
  return normalizeText(product.category ?? product.normalized_category ?? '').replace(/[^a-z0-9äöüß]/g, '');
}

export function buildKauvioProductFingerprint(product = {}) {
  const titleTokens = tokenize(product.title ?? product.name ?? product.product_title ?? '');
  const brand = normalizeBrand(product);
  const category = normalizeCategory(product);
  const modelTokens = extractModelTokens(product);
  const importantTokens = unique([...modelTokens, ...titleTokens.filter((token) => /\d/.test(token)).slice(0, 8)]);

  return {
    brand,
    category,
    title_tokens: unique(titleTokens).sort(),
    model_tokens: modelTokens.sort(),
    important_tokens: importantTokens.sort(),
    fingerprint: unique([brand, category, ...modelTokens, ...importantTokens]).join('|'),
  };
}

export function scoreKauvioProductMatch(productA = {}, productB = {}) {
  const a = buildKauvioProductFingerprint(productA);
  const b = buildKauvioProductFingerprint(productB);

  const titleSimilarity = jaccard(a.title_tokens, b.title_tokens);
  const modelSimilarity = jaccard(a.model_tokens, b.model_tokens);
  const importantSimilarity = jaccard(a.important_tokens, b.important_tokens);
  const brandMatch = a.brand && b.brand && a.brand === b.brand ? 1 : 0;
  const categoryMatch = a.category && b.category && a.category === b.category ? 1 : 0;

  const score = Math.round(
    titleSimilarity * 35 +
    modelSimilarity * 30 +
    importantSimilarity * 20 +
    brandMatch * 10 +
    categoryMatch * 5
  );

  const reasons = [];
  if (brandMatch) reasons.push('gleiche Marke');
  if (categoryMatch) reasons.push('gleiche Kategorie');
  if (modelSimilarity >= 0.5) reasons.push('ähnliche Modellnummern');
  if (importantSimilarity >= 0.5) reasons.push('wichtige Produktmerkmale stimmen überein');
  if (titleSimilarity >= 0.45) reasons.push('Produkttitel sind ähnlich');

  return {
    score,
    title_similarity: titleSimilarity,
    model_similarity: modelSimilarity,
    important_similarity: importantSimilarity,
    brand_match: Boolean(brandMatch),
    category_match: Boolean(categoryMatch),
    reasons,
  };
}

export function findBestCanonicalMatch(product, candidates = [], options = {}) {
  const threshold = options.threshold ?? 72;
  const scored = candidates
    .map((candidate) => ({
      candidate,
      match: scoreKauvioProductMatch(product, candidate),
    }))
    .sort((a, b) => b.match.score - a.match.score);

  const best = scored[0] ?? null;
  if (!best || best.match.score < threshold) {
    return {
      matched: false,
      canonical: null,
      score: best?.match.score ?? 0,
      reasons: best?.match.reasons ?? [],
    };
  }

  return {
    matched: true,
    canonical: best.candidate,
    score: best.match.score,
    reasons: best.match.reasons,
  };
}

export function groupProductsIntoCanonicals(products = [], options = {}) {
  const threshold = options.threshold ?? 72;
  const canonicals = [];

  for (const product of products) {
    const match = findBestCanonicalMatch(product, canonicals, { threshold });

    if (match.matched) {
      match.canonical.offers.push(product);
      match.canonical.match_scores.push({
        product_id: product.id ?? product.url ?? product.title,
        score: match.score,
        reasons: match.reasons,
      });
      continue;
    }

    const fingerprint = buildKauvioProductFingerprint(product);
    canonicals.push({
      canonical_id: product.id ?? product.url ?? `canonical-${canonicals.length + 1}`,
      title: product.title ?? product.name ?? 'Produkt',
      brand: product.brand ?? null,
      category: product.category ?? null,
      fingerprint: fingerprint.fingerprint,
      offers: [product],
      match_scores: [],
    });
  }

  return canonicals;
}

export default {
  buildKauvioProductFingerprint,
  scoreKauvioProductMatch,
  findBestCanonicalMatch,
  groupProductsIntoCanonicals,
};
