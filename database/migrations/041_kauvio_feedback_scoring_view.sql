CREATE OR REPLACE VIEW kauvio_search_feedback_scoring AS
SELECT
  COALESCE(product_id, product_url, product_title, query) AS feedback_target,
  COUNT(*) AS total_feedback,
  COUNT(*) FILTER (WHERE feedback_type = 'fits') AS fits_count,
  COUNT(*) FILTER (WHERE feedback_type = 'great_deal') AS great_deal_count,
  COUNT(*) FILTER (WHERE feedback_type = 'not_relevant') AS not_relevant_count,
  COUNT(*) FILTER (WHERE feedback_type = 'too_expensive') AS too_expensive_count,
  COUNT(*) FILTER (WHERE feedback_type = 'wrong_category') AS wrong_category_count,
  COUNT(*) FILTER (WHERE feedback_type = 'bad_shop') AS bad_shop_count,
  COUNT(*) FILTER (WHERE feedback_type IN ('fits', 'great_deal')) AS positive_feedback,
  COUNT(*) FILTER (WHERE feedback_type IN ('not_relevant', 'too_expensive', 'wrong_category', 'bad_shop')) AS negative_feedback,
  MAX(created_at) AS last_feedback_at
FROM kauvio_search_feedback
GROUP BY COALESCE(product_id, product_url, product_title, query);
