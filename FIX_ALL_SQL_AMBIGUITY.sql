-- Complete fix for all SQL ambiguity errors in dynamic allocation functions
-- This addresses user_id and any other ambiguous column references

-- Drop and recreate all functions with proper table aliases

-- 1. Drop existing functions
DROP FUNCTION IF EXISTS calculate_daily_allocation(VARCHAR(100));
DROP FUNCTION IF EXISTS get_user_daily_allocation(UUID, VARCHAR(100));
DROP FUNCTION IF EXISTS record_daily_request_usage(UUID, VARCHAR(100));

-- 2. Recreate calculate_daily_allocation with proper aliases
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
    -- Count users who made requests today (with proper table alias)
    SELECT COUNT(DISTINCT uts.user_id) INTO v_active_users
    FROM user_token_usage_summary uts
    WHERE uts.model_name = p_model_name
    AND uts.last_reset_day::DATE = CURRENT_DATE
    AND uts.requests_made_today > 0;
    
    -- If no active users today, count users who made requests in last 7 days
    IF v_active_users = 0 THEN
        SELECT COUNT(DISTINCT tur.user_id) INTO v_active_users
        FROM token_usage_records tur
        WHERE tur.model_name = p_model_name
        AND tur.created_at >= CURRENT_DATE - INTERVAL '7 days';
    END IF;
    
    -- Minimum 1 user to avoid division by zero
    v_active_users := GREATEST(v_active_users, 1);
    
    -- Get total available requests from system tracking
    SELECT sdt.total_requests_available INTO v_total_requests
    FROM system_daily_tracking sdt
    WHERE sdt.model_name = p_model_name
    AND sdt.tracking_date = CURRENT_DATE;
    
    -- If no system tracking record, use token pools
    IF v_total_requests IS NULL THEN
        SELECT tp.total_requests_per_day INTO v_total_requests
        FROM token_pools tp
        WHERE tp.model_name = p_model_name
        AND tp.is_active = true;
        
        v_total_requests := COALESCE(v_total_requests, 3000);
    END IF;
    
    -- Calculate requests per user (with minimum guarantee of 30)
    v_requests_per_user := GREATEST(30, v_total_requests / v_active_users);
    
    RETURN QUERY SELECT v_active_users, v_requests_per_user, v_total_requests;
END;
$$ LANGUAGE plpgsql;

-- 3. Recreate get_user_daily_allocation with proper aliases and no conflicts
CREATE OR REPLACE FUNCTION get_user_daily_allocation(
    input_user_id UUID,
    input_model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash'
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
    FROM calculate_daily_allocation(input_model_name);
    
    -- Get user's current usage today (with proper table alias)
    SELECT COALESCE(uts.requests_made_today, 0) INTO v_user_usage
    FROM user_token_usage_summary uts
    WHERE uts.user_id = input_user_id
    AND uts.model_name = input_model_name
    AND uts.last_reset_day::DATE = CURRENT_DATE;
    
    v_user_usage := COALESCE(v_user_usage, 0);
    v_allocated_requests := v_allocation_result.requests_per_user;
    
    -- Update or insert user daily allocation record
    INSERT INTO user_daily_allocations (
        user_id, model_name, allocation_date, 
        allocated_requests_today, requests_used_today, active_users_count
    ) VALUES (
        input_user_id, input_model_name, CURRENT_DATE,
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
        input_model_name, CURRENT_DATE, v_allocation_result.total_requests_available,
        v_allocation_result.active_users, v_allocation_result.requests_per_user, NOW()
    )
    ON CONFLICT (model_name, tracking_date) DO UPDATE SET
        active_users_count = EXCLUDED.active_users_count,
        requests_per_user = EXCLUDED.requests_per_user,
        last_allocation_update = EXCLUDED.last_allocation_update,
        total_requests_available = EXCLUDED.total_requests_available,
        updated_at = NOW();
    
    RETURN QUERY SELECT 
        input_user_id,
        input_model_name,
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

-- 4. Recreate record_daily_request_usage with proper aliases and no conflicts
CREATE OR REPLACE FUNCTION record_daily_request_usage(
    input_user_id UUID,
    input_model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash'
)
RETURNS TABLE (
    success BOOLEAN,
    remaining_requests INTEGER,
    allocated_requests INTEGER,
    message TEXT
) AS $$
DECLARE
    v_current_allocation RECORD;
BEGIN
    -- Get current allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(input_user_id, input_model_name);
    
    -- Check if user can make request
    IF NOT v_current_allocation.can_make_request THEN
        RETURN QUERY SELECT 
            false as success,
            0 as remaining_requests,
            v_current_allocation.allocated_requests_today,
            'Daily request limit exceeded' as message;
        RETURN;
    END IF;
    
    -- Increment user's daily usage in user_token_usage_summary (with proper alias)
    INSERT INTO user_token_usage_summary (
        user_id, model_name, requests_made_today, last_reset_day
    ) VALUES (
        input_user_id, input_model_name, 1, CURRENT_DATE
    )
    ON CONFLICT (user_id, model_name) DO UPDATE SET
        requests_made_today = CASE 
            WHEN user_token_usage_summary.last_reset_day::DATE < CURRENT_DATE 
            THEN 1
            ELSE user_token_usage_summary.requests_made_today + 1
        END,
        last_reset_day = CASE 
            WHEN user_token_usage_summary.last_reset_day::DATE < CURRENT_DATE 
            THEN CURRENT_DATE
            ELSE user_token_usage_summary.last_reset_day
        END,
        updated_at = NOW();
    
    -- Update system daily tracking (with proper alias)
    UPDATE system_daily_tracking sdt
    SET total_requests_used = sdt.total_requests_used + 1,
        updated_at = NOW()
    WHERE sdt.model_name = input_model_name 
    AND sdt.tracking_date = CURRENT_DATE;
    
    -- Return success with updated allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(input_user_id, input_model_name);
    
    RETURN QUERY SELECT 
        true as success,
        v_current_allocation.requests_remaining_today,
        v_current_allocation.allocated_requests_today,
        'Request recorded successfully' as message;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'All SQL ambiguity errors fixed successfully!' as message;