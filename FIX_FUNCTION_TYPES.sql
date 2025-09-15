-- Fix for PostgreSQL function type mismatch
-- Run this SQL to fix the get_user_quota_status function

-- Drop and recreate the function with correct types
DROP FUNCTION IF EXISTS get_user_quota_status(UUID, VARCHAR(100));

CREATE OR REPLACE FUNCTION get_user_quota_status(p_user_id UUID, p_model_name VARCHAR(100) DEFAULT 'gemini-2.0-flash')
RETURNS TABLE (
  user_id UUID,
  model_name VARCHAR(100),
  allocated_tokens_per_minute INTEGER,
  allocated_requests_per_minute INTEGER,
  tokens_used_current_minute INTEGER,
  requests_made_current_minute INTEGER,
  tokens_remaining_current_minute INTEGER,
  requests_remaining_current_minute INTEGER,
  quota_percentage_used NUMERIC(5,2),
  warning_level TEXT,  -- Changed from VARCHAR(20) to TEXT
  can_make_request BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.user_id,
        q.model_name,
        q.allocated_tokens_per_minute,
        q.allocated_requests_per_minute,
        COALESCE(u.tokens_used_current_minute, 0) as tokens_used_current_minute,
        COALESCE(u.requests_made_current_minute, 0) as requests_made_current_minute,
        GREATEST(0, q.allocated_tokens_per_minute - COALESCE(u.tokens_used_current_minute, 0)) as tokens_remaining_current_minute,
        GREATEST(0, q.allocated_requests_per_minute - COALESCE(u.requests_made_current_minute, 0)) as requests_remaining_current_minute,
        CASE 
            WHEN q.allocated_tokens_per_minute > 0 
            THEN ROUND((COALESCE(u.tokens_used_current_minute, 0)::NUMERIC / q.allocated_tokens_per_minute::NUMERIC) * 100, 2)
            ELSE 0::NUMERIC(5,2)
        END as quota_percentage_used,
        CASE 
            WHEN COALESCE(u.tokens_used_current_minute, 0) >= q.allocated_tokens_per_minute * 0.95 THEN 'CRITICAL'::TEXT
            WHEN COALESCE(u.tokens_used_current_minute, 0) >= q.allocated_tokens_per_minute * 0.80 THEN 'HIGH'::TEXT
            WHEN COALESCE(u.tokens_used_current_minute, 0) >= q.allocated_tokens_per_minute * 0.60 THEN 'MEDIUM'::TEXT
            ELSE 'LOW'::TEXT
        END as warning_level,
        (COALESCE(u.tokens_used_current_minute, 0) < q.allocated_tokens_per_minute 
         AND COALESCE(u.requests_made_current_minute, 0) < q.allocated_requests_per_minute) as can_make_request
    FROM user_token_quotas q
    LEFT JOIN user_token_usage_summary u ON q.user_id = u.user_id AND q.model_name = u.model_name
    WHERE q.user_id = p_user_id 
    AND q.model_name = p_model_name
    AND q.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'Function updated successfully!' as message;