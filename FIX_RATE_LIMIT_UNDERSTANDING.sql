-- FIX: Update rate limits to reflect per-project reality
-- Rate limits are per Google Cloud project, not per API key

-- Update token_pools with correct per-project limits
UPDATE token_pools SET 
  total_requests_per_day = 200,        -- Not 200*15, just 200 total
  total_tokens_per_minute = 1000000,   -- Not 1M*15, just 1M total  
  total_requests_per_minute = 15       -- Not 15*15, just 15 total
WHERE model_name = 'gemini-2.5-flash';

-- Update system daily tracking with correct capacity
UPDATE system_daily_tracking SET 
  total_requests_available = 200       -- Not 3000, just 200 per day
WHERE model_name = 'gemini-2.5-flash' 
AND tracking_date = CURRENT_DATE;

-- Show updated limits
SELECT 
  model_name,
  total_requests_per_day as daily_requests,
  total_requests_per_minute as rpm,
  total_tokens_per_minute as tpm,
  'Limits are per Google Cloud PROJECT (shared across all API keys)' as important_note
FROM token_pools 
WHERE model_name = 'gemini-2.5-flash';

SELECT 'Rate limits corrected to reflect per-project reality!' as status;