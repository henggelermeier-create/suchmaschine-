BEGIN;

-- Produktidentität: Zubehör/Ersatzteile dürfen nicht als Hauptprodukt-Bestpreis zählen.
-- Beispiel: Dyson V15 Hauptprodukt darf keinen CHF 14.90 Filter/Aufsatz als besten Preis erhalten.

INSERT INTO ai_runtime_controls(control_key, is_enabled, control_value_json, description, updated_by, updated_at)
VALUES (
  'offer_identity_quality_guard',
  TRUE,
  '{"enabled":true,"exclude_accessories_from_main_product":true,"exclude_price_outliers":true,"accessory_offers_need_separate_product":true,"best_price_recompute_after_filter":true,"min_reasonable_ratio_against_peer_offers":0.35}'::jsonb,
  'Zubehör, Ersatzteile und extreme Preis-Ausreißer werden vom Hauptprodukt-Preisvergleich getrennt.',
  'guard_accessories_from_product_prices',
  NOW()
)
ON CONFLICT (control_key) DO UPDATE SET
  is_enabled = TRUE,
  control_value_json = COALESCE(ai_runtime_controls.control_value_json, '{}'::jsonb) || EXCLUDED.control_value_json,
  description = EXCLUDED.description,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- 1) Zubehör-/Ersatzteil-Angebote deaktivieren, wenn das Canonical-Produkt selbst kein Zubehör ist.
WITH accessory_offers AS (
  SELECT so.id,
         so.canonical_product_id,
         so.offer_title,
         so.price
  FROM source_offers_v2 so
  JOIN canonical_products cp ON cp.id = so.canonical_product_id
  WHERE COALESCE(so.is_active, TRUE) = TRUE
    AND so.price IS NOT NULL
    AND COALESCE(cp.title, '') !~* '(zubehör|zubehoer|ersatzteil|ersatz|filter|düse|duese|bürste|buerste|aufsatz|beutel|halter|adapter|ladegerät|ladegeraet|kabel|case|hülle|huelle|cover|schutzfolie|displayfolie|tasche|ständer|staender|patrone|kartusche|kompatibel|akku|batterie)'
    AND (
      COALESCE(so.offer_title, '') ~* '(zubehör|zubehoer|ersatzteil|ersatz|filter|düse|duese|bürste|buerste|aufsatz|beutel|halter|adapter|ladegerät|ladegeraet|kabel|case|hülle|huelle|cover|schutzfolie|displayfolie|tasche|ständer|staender|patrone|kartusche|kompatibel\s+mit|für\s+dyson|fuer\s+dyson|for\s+dyson|für\s+iphone|fuer\s+iphone|for\s+iphone|für\s+macbook|fuer\s+macbook|for\s+macbook)'
      OR COALESCE(so.extracted_json::text, '') ~* '(zubehör|zubehoer|ersatzteil|ersatz|filter|düse|duese|bürste|buerste|aufsatz|beutel|halter|adapter|ladegerät|ladegeraet|kabel|case|hülle|huelle|cover|schutzfolie|displayfolie|tasche|ständer|staender|patrone|kartusche|kompatibel\s+mit)'
    )
)
UPDATE source_offers_v2 so
SET is_active = FALSE,
    confidence_score = LEAST(COALESCE(so.confidence_score, 0.5), 0.18),
    extracted_json = COALESCE(so.extracted_json, '{}'::jsonb)
      || jsonb_build_object(
        'kauvio_filtered', TRUE,
        'filter_reason', 'accessory_or_spare_part_not_main_product',
        'filtered_at', NOW()
      ),
    updated_at = NOW()
FROM accessory_offers ao
WHERE so.id = ao.id;

-- 2) Extreme Preis-Ausreißer deaktivieren, wenn andere aktive Angebote für das Produkt deutlich teurer sind.
-- Das verhindert z.B. CHF 14.90 als Bestpreis neben CHF 458 für dasselbe Hauptprodukt.
WITH product_price_stats AS (
  SELECT canonical_product_id,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
         COUNT(*) AS offer_count
  FROM source_offers_v2
  WHERE COALESCE(is_active, TRUE) = TRUE
    AND price IS NOT NULL
    AND price > 0
  GROUP BY canonical_product_id
  HAVING COUNT(*) >= 2 AND percentile_cont(0.5) WITHIN GROUP (ORDER BY price) >= 80
), outlier_offers AS (
  SELECT so.id,
         so.canonical_product_id,
         so.price,
         ps.median_price
  FROM source_offers_v2 so
  JOIN product_price_stats ps ON ps.canonical_product_id = so.canonical_product_id
  WHERE COALESCE(so.is_active, TRUE) = TRUE
    AND so.price IS NOT NULL
    AND so.price > 0
    AND so.price < ps.median_price * 0.35
    AND (
      COALESCE(so.offer_title, '') ~* '(zubehör|zubehoer|ersatz|filter|düse|duese|bürste|buerste|aufsatz|beutel|halter|adapter|kabel|case|hülle|huelle|cover|schutzfolie|kompatibel)'
      OR COALESCE(so.extracted_json::text, '') ~* '(zubehör|zubehoer|ersatz|filter|düse|duese|bürste|buerste|aufsatz|beutel|halter|adapter|kabel|case|hülle|huelle|cover|schutzfolie|kompatibel)'
      OR so.price < 25
    )
)
UPDATE source_offers_v2 so
SET is_active = FALSE,
    confidence_score = LEAST(COALESCE(so.confidence_score, 0.5), 0.16),
    extracted_json = COALESCE(so.extracted_json, '{}'::jsonb)
      || jsonb_build_object(
        'kauvio_filtered', TRUE,
        'filter_reason', 'unreasonable_accessory_price_outlier',
        'filtered_at', NOW()
      ),
    updated_at = NOW()
FROM outlier_offers oo
WHERE so.id = oo.id;

-- 3) Bestpreise und Offer Counts aus den aktiven, plausiblen Angeboten neu berechnen.
WITH active_offer_rollup AS (
  SELECT canonical_product_id,
         MIN(price) FILTER (WHERE price IS NOT NULL AND price > 0) AS best_price,
         COUNT(*) FILTER (WHERE price IS NOT NULL AND price > 0) AS offer_count,
         COUNT(DISTINCT provider) FILTER (WHERE price IS NOT NULL AND price > 0) AS source_count,
         MAX(updated_at) AS last_seen_at
  FROM source_offers_v2
  WHERE COALESCE(is_active, TRUE) = TRUE
  GROUP BY canonical_product_id
)
UPDATE canonical_products cp
SET best_price = ar.best_price,
    offer_count = GREATEST(ar.offer_count, 0),
    source_count = GREATEST(ar.source_count, 0),
    last_seen_at = COALESCE(ar.last_seen_at, cp.last_seen_at),
    updated_at = NOW()
FROM active_offer_rollup ar
WHERE cp.id = ar.canonical_product_id;

-- 4) Produkte ohne plausible aktive Angebote nicht mit altem falschem Bestpreis stehen lassen.
UPDATE canonical_products cp
SET best_price = NULL,
    offer_count = 0,
    source_count = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM source_offers_v2 so
  WHERE so.canonical_product_id = cp.id
    AND COALESCE(so.is_active, TRUE) = TRUE
    AND so.price IS NOT NULL
    AND so.price > 0
)
AND (cp.best_price IS NOT NULL OR COALESCE(cp.offer_count, 0) > 0);

INSERT INTO ai_runtime_events(event_type, severity, event_payload_json, created_by, created_at)
VALUES (
  'guard_accessories_from_product_prices',
  'warning',
  jsonb_build_object(
    'inactive_accessory_offers', (SELECT COUNT(*) FROM source_offers_v2 WHERE COALESCE(is_active, TRUE) = FALSE AND COALESCE(extracted_json::text, '') LIKE '%accessory%'),
    'products_recomputed', (SELECT COUNT(*) FROM canonical_products WHERE updated_at >= NOW() - INTERVAL '2 minutes')
  ),
  'guard_accessories_from_product_prices',
  NOW()
);

COMMIT;
