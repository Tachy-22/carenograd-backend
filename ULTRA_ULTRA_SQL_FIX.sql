-- ULTRA ULTRA FIX - Completely unique column names to avoid ALL conflicts
-- This uses return column names that can't possibly conflict with any table columns

-- 1. DROP ALL FUNCTIONS (brute force)
DROP FUNCTION IF EXISTS calculate_daily_allocation(VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(p_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(model_param VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(target_model VARCHAR(100)) CASCADE;

DROP FUNCTION IF EXISTS get_user_daily_allocation(UUID, VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(p_user_id UUID, p_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(input_user_id UUID, input_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(user_param UUID, model_param VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(target_user_id UUID, target_model VARCHAR(100)) CASCADE;

DROP FUNCTION IF EXISTS record_daily_request_usage(UUID, VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(p_user_id UUID, p_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(input_user_id UUID, input_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(user_param UUID, model_param VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(target_user_id UUID, target_model VARCHAR(100)) CASCADE;

-- 2. calculate_daily_allocation - Clean version
CREATE OR REPLACE FUNCTION calculate_daily_allocation(model_input VARCHAR(100) DEFAULT 'gemini-2.0-flash')
RETURNS TABLE (
    output_active_users INTEGER,
    output_requests_per_user INTEGER,
    output_total_requests_available INTEGER
) AS $$
DECLARE
    v_active_users INTEGER;
    v_total_requests INTEGER;
    v_requests_per_user INTEGER;
BEGIN
    -- Count users who made requests today
    SELECT COUNT(DISTINCT usage_summary.user_id) INTO v_active_users
    FROM user_token_usage_summary usage_summary
    WHERE usage_summary.model_name = model_input
    AND usage_summary.last_reset_day::DATE = CURRENT_DATE
    AND usage_summary.requests_made_today > 0;
    
    -- If no active users today, count users who made requests in last 7 days
    IF v_active_users = 0 THEN
        SELECT COUNT(DISTINCT usage_records.user_id) INTO v_active_users
        FROM token_usage_records usage_records
        WHERE usage_records.model_name = model_input
        AND usage_records.created_at >= CURRENT_DATE - INTERVAL '7 days';
    END IF;
    
    -- Minimum 1 user to avoid division by zero
    v_active_users := GREATEST(v_active_users, 1);
    
    -- Get total available requests from system tracking
    SELECT daily_tracking.total_requests_available INTO v_total_requests
    FROM system_daily_tracking daily_tracking
    WHERE daily_tracking.model_name = model_input
    AND daily_tracking.tracking_date = CURRENT_DATE;
    
    -- If no system tracking record, use token pools
    IF v_total_requests IS NULL THEN
        SELECT token_pool.total_requests_per_day INTO v_total_requests
        FROM token_pools token_pool
        WHERE token_pool.model_name = model_input
        AND token_pool.is_active = true;
        
        v_total_requests := COALESCE(v_total_requests, 3000);
    END IF;
    
    -- Calculate requests per user (with minimum guarantee of 30)
    v_requests_per_user := GREATEST(30, v_total_requests / v_active_users);
    
    RETURN QUERY SELECT v_active_users, v_requests_per_user, v_total_requests;
END;
$$ LANGUAGE plpgsql;

-- 3. get_user_daily_allocation - With completely unique return columns
CREATE OR REPLACE FUNCTION get_user_daily_allocation(
    user_input UUID,
    model_input VARCHAR(100) DEFAULT 'gemini-2.0-flash'
)
RETURNS TABLE (
    output_user_id UUID,
    output_model_name VARCHAR(100),
    output_allocated_requests_today INTEGER,
    output_requests_used_today INTEGER,
    output_requests_remaining_today INTEGER,
    output_allocation_percentage_used NUMERIC(5,2),
    output_can_make_request BOOLEAN,
    output_active_users_count INTEGER
) AS $$
DECLARE
    v_allocation_result RECORD;
    v_user_usage INTEGER;
    v_allocated_requests INTEGER;
BEGIN
    -- Get current dynamic allocation
    SELECT * INTO v_allocation_result
    FROM calculate_daily_allocation(model_input);
    
    -- Get user's current usage today
    SELECT COALESCE(usage_summary.requests_made_today, 0) INTO v_user_usage
    FROM user_token_usage_summary usage_summary
    WHERE usage_summary.user_id = user_input
    AND usage_summary.model_name = model_input
    AND usage_summary.last_reset_day::DATE = CURRENT_DATE;
    
    v_user_usage := COALESCE(v_user_usage, 0);
    v_allocated_requests := v_allocation_result.output_requests_per_user;
    
    -- Update or insert user daily allocation record
    INSERT INTO user_daily_allocations (
        user_id, model_name, allocation_date, 
        allocated_requests_today, requests_used_today, active_users_count
    ) VALUES (
        user_input, model_input, CURRENT_DATE,
        v_allocated_requests, v_user_usage, v_allocation_result.output_active_users
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
        model_input, CURRENT_DATE, v_allocation_result.output_total_requests_available,
        v_allocation_result.output_active_users, v_allocation_result.output_requests_per_user, NOW()
    )
    ON CONFLICT (model_name, tracking_date) DO UPDATE SET
        active_users_count = EXCLUDED.active_users_count,
        requests_per_user = EXCLUDED.requests_per_user,
        last_allocation_update = EXCLUDED.last_allocation_update,
        total_requests_available = EXCLUDED.total_requests_available,
        updated_at = NOW();
    
    -- Return with completely unique output column names
    RETURN QUERY SELECT 
        user_input,
        model_input,
        v_allocated_requests,
        v_user_usage,
        GREATEST(0, v_allocated_requests - v_user_usage),
        CASE 
            WHEN v_allocated_requests > 0 
            THEN ROUND((v_user_usage::NUMERIC / v_allocated_requests::NUMERIC) * 100, 2)
            ELSE 0::NUMERIC(5,2)
        END,
        (v_user_usage < v_allocated_requests),
        v_allocation_result.output_active_users;
END;
$$ LANGUAGE plpgsql;

-- 4. record_daily_request_usage - With unique return columns
CREATE OR REPLACE FUNCTION record_daily_request_usage(
    user_input UUID,
    model_input VARCHAR(100) DEFAULT 'gemini-2.0-flash'
)
RETURNS TABLE (
    output_success BOOLEAN,
    output_remaining_requests INTEGER,
    output_allocated_requests INTEGER,
    output_message TEXT
) AS $$
DECLARE
    v_current_allocation RECORD;
BEGIN
    -- Get current allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(user_input, model_input);
    
    -- Check if user can make request
    IF NOT v_current_allocation.output_can_make_request THEN
        RETURN QUERY SELECT 
            false,
            0,
            v_current_allocation.output_allocated_requests_today,
            'Daily request limit exceeded'::TEXT;
        RETURN;
    END IF;
    
    -- Increment user's daily usage in user_token_usage_summary
    INSERT INTO user_token_usage_summary (
        user_id, model_name, requests_made_today, last_reset_day
    ) VALUES (
        user_input, model_input, 1, CURRENT_DATE
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
    
    -- Update system daily tracking
    UPDATE system_daily_tracking daily_tracking
    SET total_requests_used = daily_tracking.total_requests_used + 1,
        updated_at = NOW()
    WHERE daily_tracking.model_name = model_input 
    AND daily_tracking.tracking_date = CURRENT_DATE;
    
    -- Return success with updated allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(user_input, model_input);
    
    RETURN QUERY SELECT 
        true,
        v_current_allocation.output_requests_remaining_today,
        v_current_allocation.output_allocated_requests_today,
        'Request recorded successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. Force complete schema refresh
SELECT pg_notify('pgrst', 'reload schema');

-- Success message
SELECT 'ULTRA ULTRA FIX: All conflicts eliminated with unique output_ column names!' as message,
       'Parameters: user_input, model_input' as parameters,
       'Returns: output_user_id, output_model_name, etc.' as returns;