-- Fix for SQL ambiguity error in dynamic allocation functions
-- Run this to fix the "column reference 'total_requests_available' is ambiguous" error

-- Drop and recreate the calculate_daily_allocation function with proper table aliases
DROP FUNCTION IF EXISTS calculate_daily_allocation(VARCHAR(100));

CREATE OR REPLACE FUNCTION calculate_daily_allocation(p_model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash')
RETURNS TABLE (
    active_users INTEGER,
    requests_per_user INTEGER,
    total_requests_available INTEGER
) AS $$
DECLARE
    v_active_users INTEGER;
    v_total_requests INTEGER;
    v_requests_per_user INTEGER;
BEGIN
    -- Count users who made requests today
    SELECT COUNT(DISTINCT user_id) INTO v_active_users
    FROM user_token_usage_summary uts
    WHERE uts.model_name = p_model_name
    AND uts.last_reset_day::DATE = CURRENT_DATE
    AND uts.requests_made_today > 0;
    
    -- If no active users today, count users who made requests in last 7 days
    IF v_active_users = 0 THEN
        SELECT COUNT(DISTINCT user_id) INTO v_active_users
        FROM token_usage_records tur
        WHERE tur.model_name = p_model_name
        AND tur.created_at >= CURRENT_DATE - INTERVAL '7 days';
    END IF;
    
    -- Minimum 1 user to avoid division by zero
    v_active_users := GREATEST(v_active_users, 1);
    
    -- Get total available requests from system tracking or calculate from token pools
    SELECT sdt.total_requests_available INTO v_total_requests
    FROM system_daily_tracking sdt
    WHERE sdt.model_name = p_model_name
    AND sdt.tracking_date = CURRENT_DATE;
    
    -- If no system tracking record, use token pools (already multiplied by 15 in UPDATE above)
    IF v_total_requests IS NULL THEN
        SELECT tp.total_requests_per_day INTO v_total_requests  -- Already includes 15 API keys
        FROM token_pools tp
        WHERE tp.model_name = p_model_name
        AND tp.is_active = true;
        
        v_total_requests := COALESCE(v_total_requests, 3000); -- Fallback: 15 keys × 200 RPD
    END IF;
    
    -- Calculate requests per user (with minimum guarantee of 30)
    v_requests_per_user := GREATEST(30, v_total_requests / v_active_users);
    
    RETURN QUERY SELECT v_active_users, v_requests_per_user, v_total_requests;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the get_user_daily_allocation function with proper table aliases
DROP FUNCTION IF EXISTS get_user_daily_allocation(UUID, VARCHAR(100));

CREATE OR REPLACE FUNCTION get_user_daily_allocation(
    p_user_id UUID,
    p_model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash'
)
RETURNS TABLE (
    user_id UUID,
    model_name VARCHAR(100),
    allocated_requests_today INTEGER,
    requests_used_today INTEGER,
    requests_remaining_today INTEGER,
    allocation_percentage_used NUMERIC(5,2),
    can_make_request BOOLEAN,
    active_users_count INTEGER
) AS $$
DECLARE
    v_allocation_result RECORD;
    v_user_usage INTEGER;
    v_allocated_requests INTEGER;
BEGIN
    -- Get current dynamic allocation
    SELECT * INTO v_allocation_result
    FROM calculate_daily_allocation(p_model_name);
    
    -- Get user's current usage today
    SELECT COALESCE(uts.requests_made_today, 0) INTO v_user_usage
    FROM user_token_usage_summary uts
    WHERE uts.user_id = p_user_id
    AND uts.model_name = p_model_name
    AND uts.last_reset_day::DATE = CURRENT_DATE;
    
    v_user_usage := COALESCE(v_user_usage, 0);
    v_allocated_requests := v_allocation_result.requests_per_user;
    
    -- Update or insert user daily allocation record
    INSERT INTO user_daily_allocations (
        user_id, model_name, allocation_date, 
        allocated_requests_today, requests_used_today, active_users_count
    ) VALUES (
        p_user_id, p_model_name, CURRENT_DATE,
        v_allocated_requests, v_user_usage, v_allocation_result.active_users
    )
    ON CONFLICT (user_id, model_name, allocation_date) DO UPDATE SET
        allocated_requests_today = EXCLUDED.allocated_requests_today,
        requests_used_today = EXCLUDED.requests_used_today,
        active_users_count = EXCLUDED.active_users_count,
        updated_at = NOW();
    
    -- Update system daily tracking
    INSERT INTO system_daily_tracking (
        model_name, tracking_date, total_requests_available,
        active_users_count, requests_per_user, last_allocation_update
    ) VALUES (
        p_model_name, CURRENT_DATE, v_allocation_result.total_requests_available,
        v_allocation_result.active_users, v_allocation_result.requests_per_user, NOW()
    )
    ON CONFLICT (model_name, tracking_date) DO UPDATE SET
        active_users_count = EXCLUDED.active_users_count,
        requests_per_user = EXCLUDED.requests_per_user,
        last_allocation_update = EXCLUDED.last_allocation_update,
        total_requests_available = EXCLUDED.total_requests_available,
        updated_at = NOW();
    
    RETURN QUERY SELECT 
        p_user_id,
        p_model_name,
        v_allocated_requests,
        v_user_usage,
        GREATEST(0, v_allocated_requests - v_user_usage) as requests_remaining,
        CASE 
            WHEN v_allocated_requests > 0 
            THEN ROUND((v_user_usage::NUMERIC / v_allocated_requests::NUMERIC) * 100, 2)
            ELSE 0
        END as allocation_percentage,
        (v_user_usage < v_allocated_requests) as can_make,
        v_allocation_result.active_users;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'SQL ambiguity errors fixed successfully!' as message;