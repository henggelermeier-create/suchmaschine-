BEGIN;

CREATE OR REPLACE FUNCTION public.auto_register_swiss_source_from_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_candidate_url TEXT;
  v_host TEXT;
  v_source_key TEXT;
  v_display_name TEXT;
BEGIN
  v_candidate_url := COALESCE(NEW.deeplink_url, NEW.source_product_url);
  v_host := public.extract_hostname(v_candidate_url);

  IF v_host IS NULL OR v_host !~ '\.ch$' THEN
    RETURN NEW;
  END IF;

  IF v_host ~ '(^|\.)toppreise\.ch$' THEN
    RETURN NEW;
  END IF;

  v_source_key := public.make_source_key_from_host(v_host);
  v_display_name := COALESCE(public.make_display_name_from_host(v_host), NEW.provider, v_host);

  IF v_source_key IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO swiss_sources(
    source_key,
    display_name,
    provider_kind,
    source_kind,
    country_code,
    language_code,
    base_url,
    seed_urls_json,
    categories_json,
    priority,
    confidence_score,
    refresh_interval_minutes,
    is_active,
    notes,
    shop_domain,
    auto_discovered,
    discovery_source_key,
    created_at,
    updated_at
  )
  VALUES (
    v_source_key,
    v_display_name,
    'shop_source',
    'shop_catalog',
    'CH',
    'de',
    'https://' || v_host,
    jsonb_build_array(v_candidate_url),
    '[]'::jsonb,
    38,
    0.46,
    240,
    TRUE,
    'Automatisch aus Offer-URLs erkannter Schweizer Shop.',
    v_host,
    TRUE,
    'offer_trigger',
    NOW(),
    NOW()
  )
  ON CONFLICT (source_key) DO UPDATE
  SET shop_domain = COALESCE(swiss_sources.shop_domain, EXCLUDED.shop_domain),
      auto_discovered = TRUE,
      updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMIT;
