const DEFAULT_CURRENCY = 'CHF';
const DEFAULT_REGION = 'CH';

const CATEGORY_HINTS = [
  { category: 'laptop', terms: ['laptop', 'notebook', 'macbook', 'chromebook', 'schule', 'student', 'studium'] },
  { category: 'phone', terms: ['handy', 'smartphone', 'iphone', 'android', 'telefon'] },
  { category: 'tv', terms: ['fernseher', 'tv', 'oled', 'qled', '4k', 'uhd'] },
  { category: 'coffee_machine', terms: ['kaffeemaschine', 'kaffeevollautomat', 'espresso', 'siebträger'] },
  { category: 'shoes', terms: ['schuhe', 'sneaker', 'wanderschuhe', 'arbeitsschuhe', 'stehen'] },
  { category: 'headphones', terms: ['kopfhörer', 'headset', 'earbuds', 'noise cancelling', 'anc'] },
  { category: 'vacuum', terms: ['staubsauger', 'saugroboter', 'dyson', 'roborock'] },
  { category: 'watch', terms: ['uhr', 'smartwatch', 'apple watch', 'garmin'] },
];

const USE_CASE_HINTS = [
  { useCase: 'school', terms: ['schule', 'student', 'studium', 'uni', 'lernen'], priorities: ['battery', 'weight', 'reliability', 'value'] },
  { useCase: 'work', terms: ['arbeit', 'büro', 'office', 'business'], priorities: ['reliability', 'performance', 'warranty', 'delivery'] },
  { useCase: 'gaming', terms: ['gaming', 'zocken', 'fps', 'grafikkarte'], priorities: ['performance', 'graphics', 'cooling'] },
  { useCase: 'travel', terms: ['reise', 'reisen', 'leicht', 'kompakt'], priorities: ['weight', 'battery', 'size'] },
  { useCase: 'budget', terms: ['günstig', 'billig', 'unter', 'max', 'budget'], priorities: ['price', 'value'] },
  { useCase: 'premium', terms: ['beste', 'premium', 'hochwertig', 'top'], priorities: ['quality', 'reviews', 'brand'] },
  { useCase: 'comfort', terms: ['bequem', 'komfort', 'langes stehen', 'ergonomisch'], priorities: ['comfort', 'reviews', 'return_policy'] },
];

const STOP_WORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einen', 'und', 'oder', 'für', 'mit', 'ohne', 'unter', 'über',
  'bis', 'von', 'im', 'in', 'am', 'an', 'zu', 'zur', 'zum', 'beste', 'bester', 'bestes', 'gute',
  'guter', 'gutes', 'ich', 'suche', 'brauche', 'kaufen', 'kauf', 'chf', 'fr', 'sfr', 'schweiz',
]);

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß.\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term && term.length > 1 && !STOP_WORDS.has(term));
}

function hasAny(text, terms) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function extractBudget(query) {
  const normalized = normalizeText(query);
  const patterns = [
    /(?:unter|max(?:imal)?|bis|budget)\s*(?:ca\.?\s*)?(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:chf|fr|sfr)?/i,
    /(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:chf|fr|sfr)\s*(?:max|maximum|budget|obergrenze)?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return Number.parseFloat(match[1].replace(',', '.'));
    }
  }

  return null;
}

function detectCategory(query) {
  const hit = CATEGORY_HINTS.find((entry) => hasAny(query, entry.terms));
  return hit?.category ?? null;
}

function detectUseCases(query) {
  return USE_CASE_HINTS.filter((entry) => hasAny(query, entry.terms)).map((entry) => entry.useCase);
}

function detectPriorities(query, useCases) {
  const priorities = new Set();

  for (const entry of USE_CASE_HINTS) {
    if (useCases.includes(entry.useCase) || hasAny(query, entry.terms)) {
      entry.priorities.forEach((priority) => priorities.add(priority));
    }
  }

  if (hasAny(query, ['deal', 'aktion', 'rabatt', 'sale', 'angebot'])) priorities.add('deal');
  if (hasAny(query, ['schnell', 'morgen', 'sofort', 'lieferbar'])) priorities.add('delivery');
  if (hasAny(query, ['vertrauenswürdig', 'seriös', 'sicher'])) priorities.add('trust');

  return [...priorities];
}

export function extractKauvioSearchIntent(query, options = {}) {
  const rawQuery = String(query ?? '').trim();
  const tokens = tokenize(rawQuery);
  const budgetMax = extractBudget(rawQuery);
  const category = detectCategory(rawQuery);
  const useCases = detectUseCases(rawQuery);
  const priorities = detectPriorities(rawQuery, useCases);

  return {
    original_query: rawQuery,
    normalized_query: normalizeText(rawQuery),
    language: options.language ?? 'de-CH',
    region: options.region ?? DEFAULT_REGION,
    currency: options.currency ?? DEFAULT_CURRENCY,
    category,
    budget: budgetMax ? { max: budgetMax, currency: options.currency ?? DEFAULT_CURRENCY } : null,
    use_cases: useCases,
    priorities: priorities.length ? priorities : ['value', 'trust', 'price'],
    query_terms: tokens,
    filters: {
      category,
      max_price: budgetMax,
      currency: options.currency ?? DEFAULT_CURRENCY,
      in_stock: true,
      region: options.region ?? DEFAULT_REGION,
    },
    ranking_strategy: 'kauvio_ai_product_decision',
  };
}

export function buildKauvioHybridSearchPlan(intent) {
  const searchText = intent.normalized_query || intent.original_query;
  const semanticText = [
    intent.original_query,
    intent.category,
    ...intent.use_cases,
    ...intent.priorities,
  ].filter(Boolean).join(' ');

  return {
    keyword: {
      enabled: true,
      query: searchText,
      terms: intent.query_terms,
      weight: 0.35,
    },
    vector: {
      enabled: true,
      input: semanticText,
      weight: 0.35,
      purpose: 'Find products that match the user intent even when product wording differs.',
    },
    filters: intent.filters,
    ai_rerank: {
      enabled: true,
      weight: 0.3,
      top_k: 50,
      objective: 'Rank by best purchase decision, not by text match only.',
    },
  };
}

function toNumber(value, fallback = 0) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getProductText(product) {
  return normalizeText([
    product.title,
    product.name,
    product.brand,
    product.category,
    product.description,
    product.merchant,
    product.shop,
  ].filter(Boolean).join(' '));
}

function estimateTextRelevance(product, intent) {
  const productText = getProductText(product);
  if (!intent.query_terms.length) return 45;

  const hits = intent.query_terms.filter((term) => productText.includes(normalizeText(term))).length;
  const ratio = hits / intent.query_terms.length;
  const categoryBonus = intent.category && productText.includes(normalizeText(intent.category)) ? 15 : 0;
  return clamp(Math.round(ratio * 75 + categoryBonus));
}

function estimateBudgetFit(product, intent) {
  if (!intent.budget?.max) return 70;
  const price = toNumber(product.price ?? product.current_price ?? product.amount, null);
  if (!price) return 35;
  if (price <= intent.budget.max) return clamp(100 - ((intent.budget.max - price) / intent.budget.max) * 10);
  const overBudgetRatio = (price - intent.budget.max) / intent.budget.max;
  return clamp(55 - overBudgetRatio * 120);
}

function estimateAvailability(product) {
  const text = normalizeText([product.availability, product.stock_status, product.delivery_status].filter(Boolean).join(' '));
  if (product.in_stock === true || text.includes('lieferbar') || text.includes('in stock')) return 100;
  if (text.includes('wenige') || text.includes('limited')) return 75;
  if (text.includes('nicht') || text.includes('out of stock') || product.in_stock === false) return 10;
  return 60;
}

function estimateTrust(product) {
  const explicit = product.trust_score ?? product.merchant_trust_score ?? product.shop_trust_score;
  if (explicit !== undefined && explicit !== null) return clamp(toNumber(explicit));

  let score = 55;
  const merchant = normalizeText(product.merchant ?? product.shop ?? product.domain ?? '');
  if (merchant.endsWith('.ch') || merchant.includes('schweiz') || merchant.includes('swiss')) score += 10;
  if (product.return_policy || product.has_return_policy) score += 10;
  if (product.warranty || product.guarantee) score += 8;
  if (product.rating && toNumber(product.rating) >= 4) score += 8;
  if (product.reviews_count && toNumber(product.reviews_count) > 20) score += 6;
  return clamp(score);
}

function estimateDealScore(product) {
  const explicit = product.deal_score ?? product.price_deal_score;
  if (explicit !== undefined && explicit !== null) return clamp(toNumber(explicit));

  const price = toNumber(product.price ?? product.current_price, null);
  const avg90 = toNumber(product.avg_90d_price ?? product.price_avg_90d ?? product.average_price_90d, null);
  const previous = toNumber(product.previous_price ?? product.original_price ?? product.list_price, null);

  if (price && avg90 && avg90 > price) {
    return clamp(60 + ((avg90 - price) / avg90) * 120);
  }

  if (price && previous && previous > price) {
    return clamp(55 + ((previous - price) / previous) * 100);
  }

  return 50;
}

function estimateQuality(product, intent) {
  let score = 55;
  const rating = toNumber(product.rating, null);
  if (rating) score += clamp((rating - 3) * 18, -20, 30);
  if (product.reviews_count) score += clamp(Math.log10(toNumber(product.reviews_count) + 1) * 8, 0, 20);
  if (product.ai_quality_score) score = toNumber(product.ai_quality_score);

  const text = getProductText(product);
  if (intent.priorities.includes('battery') && /akku|battery|laufzeit/.test(text)) score += 5;
  if (intent.priorities.includes('comfort') && /komfort|bequem|dämpfung|ergonom/.test(text)) score += 7;
  if (intent.priorities.includes('performance') && /leistung|performance|prozessor|cpu|gpu|ram/.test(text)) score += 5;
  return clamp(score);
}

export function scoreProductForKauvio(product, intent) {
  const signals = {
    relevance: estimateTextRelevance(product, intent),
    budget_fit: estimateBudgetFit(product, intent),
    deal: estimateDealScore(product),
    trust: estimateTrust(product),
    availability: estimateAvailability(product),
    quality: estimateQuality(product, intent),
  };

  const score = Math.round(
    signals.relevance * 0.24 +
    signals.budget_fit * 0.18 +
    signals.deal * 0.18 +
    signals.trust * 0.16 +
    signals.availability * 0.12 +
    signals.quality * 0.12
  );

  const reasons = buildRankingReasons(product, intent, signals, score);

  return {
    ...product,
    kauvio_score: clamp(score),
    kauvio_signals: signals,
    ranking_reasons: reasons,
    decision_badge: getDecisionBadge(score, signals),
  };
}

function getDecisionBadge(score, signals) {
  if (signals.availability < 30) return 'Nicht ideal: aktuell schlecht verfügbar';
  if (score >= 86 && signals.deal >= 75) return 'Top-Empfehlung & starker Deal';
  if (score >= 82) return 'Top-Empfehlung';
  if (signals.deal >= 80) return 'Bester Deal';
  if (signals.budget_fit >= 90 && signals.quality >= 65) return 'Beste günstige Alternative';
  if (signals.quality >= 82 && signals.trust >= 75) return 'Beste Premium-Alternative';
  return 'Solide Option';
}

function buildRankingReasons(product, intent, signals, score) {
  const reasons = [];
  const price = toNumber(product.price ?? product.current_price, null);

  if (score >= 82) reasons.push('passt sehr gut zur Suchabsicht');
  if (intent.budget?.max && price && price <= intent.budget.max) reasons.push(`liegt im Budget bis ${intent.budget.max} ${intent.currency}`);
  if (signals.deal >= 75) reasons.push('wirkt preislich aktuell attraktiv');
  if (signals.trust >= 75) reasons.push('Händler-/Vertrauenssignale sind stark');
  if (signals.availability >= 85) reasons.push('ist voraussichtlich gut verfügbar');
  if (signals.quality >= 75) reasons.push('Qualitäts- und Bewertungsmerkmale sind gut');
  if (!reasons.length) reasons.push('wurde als mögliche Alternative gefunden, sollte aber geprüft werden');

  return reasons;
}

export function rankProductsForKauvio(query, products = [], options = {}) {
  const intent = extractKauvioSearchIntent(query, options);
  const plan = buildKauvioHybridSearchPlan(intent);
  const rankedProducts = products
    .map((product) => scoreProductForKauvio(product, intent))
    .sort((a, b) => b.kauvio_score - a.kauvio_score);

  return {
    intent,
    plan,
    products: rankedProducts,
    advisor: buildKauvioAdvisorResponse(intent, rankedProducts),
  };
}

export function buildKauvioAdvisorResponse(intent, rankedProducts = []) {
  const top = rankedProducts[0] ?? null;
  const bestDeal = rankedProducts.find((product) => product.kauvio_signals?.deal >= 75) ?? null;
  const budgetAlternative = rankedProducts.find((product) => product.kauvio_signals?.budget_fit >= 90 && product !== top) ?? null;
  const premiumAlternative = rankedProducts.find((product) => product.kauvio_signals?.quality >= 82 && product !== top) ?? null;
  const warnings = rankedProducts
    .filter((product) => product.kauvio_signals?.availability < 30 || product.kauvio_signals?.trust < 35)
    .slice(0, 3)
    .map((product) => ({
      id: product.id ?? product.url ?? product.title,
      title: product.title ?? product.name,
      warning: product.kauvio_signals?.availability < 30
        ? 'Schlecht verfügbar oder nicht lieferbar.'
        : 'Niedrige Vertrauenssignale. Vor Kauf prüfen.',
    }));

  return {
    summary: top
      ? `Beste Wahl: ${top.title ?? top.name} mit Kauvio Score ${top.kauvio_score}/100.`
      : 'Noch keine passende Produktempfehlung gefunden.',
    top_recommendation: top,
    best_deal: bestDeal,
    budget_alternative: budgetAlternative,
    premium_alternative: premiumAlternative,
    warnings,
    explanation: top ? top.ranking_reasons : [],
    intent_snapshot: {
      category: intent.category,
      budget: intent.budget,
      use_cases: intent.use_cases,
      priorities: intent.priorities,
    },
  };
}

export default {
  extractKauvioSearchIntent,
  buildKauvioHybridSearchPlan,
  scoreProductForKauvio,
  rankProductsForKauvio,
  buildKauvioAdvisorResponse,
};
