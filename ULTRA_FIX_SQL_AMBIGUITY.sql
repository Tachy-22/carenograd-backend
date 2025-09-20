-- ULTRA FIX: Complete elimination of all SQL ambiguity errors
-- This addresses ALL possible parameter/column conflicts

-- 1. Drop ALL existing functions completely
DROP FUNCTION IF EXISTS calculate_daily_allocation(VARCHAR(100));
DROP FUNCTION IF EXISTS get_user_daily_allocation(UUID, VARCHAR(100));
DROP FUNCTION IF EXISTS record_daily_request_usage(UUID, VARCHAR(100));
DROP FUNCTION IF EXISTS get_user_daily_allocation(input_user_id UUID, input_model_name VARCHAR(100));
DROP FUNCTION IF EXISTS record_daily_request_usage(input_user_id UUID, input_model_name VARCHAR(100));

-- 2. Create calculate_daily_allocation with completely clean parameters
CREATE OR REPLACE FUNCTION calculate_daily_allocation(model_param VARCHAR(100) DEFAULT 'gemini-2.5-flash')
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
    SELECT COUNT(DISTINCT uts.user_id) INTO v_active_users
    FROM user_token_usage_summary uts
    WHERE uts.model_name = model_param
    AND uts.last_reset_day::DATE = CURRENT_DATE
    AND uts.requests_made_today > 0;
    
    -- If no active users today, count users who made requests in last 7 days
    IF v_active_users = 0 THEN
        SELECT COUNT(DISTINCT tur.user_id) INTO v_active_users
        FROM token_usage_records tur
        WHERE tur.model_name = model_param
        AND tur.created_at >= CURRENT_DATE - INTERVAL '7 days';
    END IF;
    
    -- Minimum 1 user to avoid division by zero
    v_active_users := GREATEST(v_active_users, 1);
    
    -- Get total available requests from system tracking
    SELECT sdt.total_requests_available INTO v_total_requests
    FROM system_daily_tracking sdt
    WHERE sdt.model_name = model_param
    AND sdt.tracking_date = CURRENT_DATE;
    
    -- If no system tracking record, use token pools
    IF v_total_requests IS NULL THEN
        SELECT tp.total_requests_per_day INTO v_total_requests
        FROM token_pools tp
        WHERE tp.model_name = model_param
        AND tp.is_active = true;
        
        v_total_requests := COALESCE(v_total_requests, 3000);
    END IF;
    
    -- Calculate requests per user (with minimum guarantee of 30)
    v_requests_per_user := GREATEST(30, v_total_requests / v_active_users);
    
    RETURN QUERY SELECT v_active_users, v_requests_per_user, v_total_requests;
END;
$$ LANGUAGE plpgsql;

-- 3. Create get_user_daily_allocation with completely different column names in return
CREATE OR REPLACE FUNCTION get_user_daily_allocation(
    user_param UUID,
    model_param VARCHAR(100) DEFAULT 'gemini-2.5-flash'
)
RETURNS TABLE (
    result_user_id UUID,
    result_model_name VARCHAR(100),
    result_allocated_requests_today INTEGER,
    result_requests_used_today INTEGER,
    result_requests_remaining_today INTEGER,
    result_allocation_percentage_used NUMERIC(5,2),
    result_can_make_request BOOLEAN,
    result_active_users_count INTEGER
) AS $$
DECLARE
    v_allocation_result RECORD;
    v_user_usage INTEGER;
    v_allocated_requests INTEGER;
BEGIN
    -- Get current dynamic allocation
    SELECT * INTO v_allocation_result
    FROM calculate_daily_allocation(model_param);
    
    -- Get user's current usage today
    SELECT COALESCE(uts.requests_made_today, 0) INTO v_user_usage
    FROM user_token_usage_summary uts
    WHERE uts.user_id = user_param
    AND uts.model_name = model_param
    AND uts.last_reset_day::DATE = CURRENT_DATE;
    
    v_user_usage := COALESCE(v_user_usage, 0);
    v_allocated_requests := v_allocation_result.requests_per_user;
    
    -- Update or insert user daily allocation record
    INSERT INTO user_daily_allocations (
        user_id, model_name, allocation_date, 
        allocated_requests_today, requests_used_today, active_users_count
    ) VALUES (
        user_param, model_param, CURRENT_DATE,
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
        model_param, CURRENT_DATE, v_allocation_result.total_requests_available,
        v_allocation_result.active_users, v_allocation_result.requests_per_user, NOW()
    )
    ON CONFLICT (model_name, tracking_date) DO UPDATE SET
        active_users_count = EXCLUDED.active_users_count,
        requests_per_user = EXCLUDED.requests_per_user,
        last_allocation_update = EXCLUDED.last_allocation_update,
        total_requests_available = EXCLUDED.total_requests_available,
        updated_at = NOW();
    
    -- Return with completely different column names to avoid conflicts
    RETURN QUERY SELECT 
        user_param as result_user_id,
        model_param as result_model_name,
        v_allocated_requests as result_allocated_requests_today,
        v_user_usage as result_requests_used_today,
        GREATEST(0, v_allocated_requests - v_user_usage) as result_requests_remaining_today,
        CASE 
            WHEN v_allocated_requests > 0 
            THEN ROUND((v_user_usage::NUMERIC / v_allocated_requests::NUMERIC) * 100, 2)
            ELSE 0::NUMERIC(5,2)
        END as result_allocation_percentage_used,
        (v_user_usage < v_allocated_requests) as result_can_make_request,
        v_allocation_result.active_users as result_active_users_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Create record_daily_request_usage with clean parameters
CREATE OR REPLACE FUNCTION record_daily_request_usage(
    user_param UUID,
    model_param VARCHAR(100) DEFAULT 'gemini-2.5-flash'
)
RETURNS TABLE (
    result_success BOOLEAN,
    result_remaining_requests INTEGER,
    result_allocated_requests INTEGER,
    result_message TEXT
) AS $$
DECLARE
    v_current_allocation RECORD;
BEGIN
    -- Get current allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(user_param, model_param);
    
    -- Check if user can make request
    IF NOT v_current_allocation.result_can_make_request THEN
        RETURN QUERY SELECT 
            false as result_success,
            0 as result_remaining_requests,
            v_current_allocation.result_allocated_requests_today as result_allocated_requests,
            'Daily request limit exceeded' as result_message;
        RETURN;
    END IF;
    
    -- Increment user's daily usage in user_token_usage_summary
    INSERT INTO user_token_usage_summary (
        user_id, model_name, requests_made_today, last_reset_day
    ) VALUES (
        user_param, model_param, 1, CURRENT_DATE
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
    UPDATE system_daily_tracking sdt
    SET total_requests_used = sdt.total_requests_used + 1,
        updated_at = NOW()
    WHERE sdt.model_name = model_param 
    AND sdt.tracking_date = CURRENT_DATE;
    
    -- Return success with updated allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(user_param, model_param);
    
    RETURN QUERY SELECT 
        true as result_success,
        v_current_allocation.result_requests_remaining_today as result_remaining_requests,
        v_current_allocation.result_allocated_requests_today as result_allocated_requests,
        'Request recorded successfully' as result_message;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'ULTRA FIX: All SQL ambiguity errors completely eliminated!' as message;