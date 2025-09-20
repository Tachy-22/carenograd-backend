-- Dynamic RPD Allocation System - Schema Updates
-- Enhances existing token tracking to support dynamic daily request allocation

-- 1. Update token_pools table to include RPD tracking
ALTER TABLE token_pools ADD COLUMN IF NOT EXISTS total_requests_per_day INTEGER DEFAULT 200;

-- Update existing gemini models with correct RPD limits (15 API keys multiplied)
UPDATE token_pools SET 
  total_requests_per_day = 200 * 15,  -- 3000 total (15 keys × 200 RPD each)
  total_tokens_per_minute = 1000000 * 15,  -- 15M total (15 keys × 1M TPM each)
  total_requests_per_minute = 15 * 15  -- 225 total (15 keys × 15 RPM each)
WHERE model_name = 'gemini-2.5-flash';

-- 2. Create daily user allocation tracking table
CREATE TABLE IF NOT EXISTS user_daily_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    allocated_requests_today INTEGER NOT NULL DEFAULT 0,
    requests_used_today INTEGER NOT NULL DEFAULT 0,
    active_users_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_name, allocation_date)
);

-- 3. Create system daily tracking table
CREATE TABLE IF NOT EXISTS system_daily_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests_available INTEGER NOT NULL DEFAULT 3000, -- 15 keys × 200 RPD
    total_requests_used INTEGER NOT NULL DEFAULT 0,
    active_users_count INTEGER NOT NULL DEFAULT 0,
    requests_per_user INTEGER NOT NULL DEFAULT 0,
    last_allocation_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(model_name, tracking_date)
);

-- 4. Initialize system tracking for gemini-2.5-flash with 15 API keys
INSERT INTO system_daily_tracking (model_name, total_requests_available)
VALUES ('gemini-2.5-flash', 200 * 15) -- 15 API keys × 200 RPD = 3000 total
ON CONFLICT (model_name, tracking_date) DO NOTHING;

-- 5. Create function to calculate dynamic daily allocation
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

-- 6. Create function to get user's current daily allocation
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
    SELECT COALESCE(requests_made_today, 0) INTO v_user_usage
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

-- 7. Create function to record request usage and update daily allocation
CREATE OR REPLACE FUNCTION record_daily_request_usage(
    p_user_id UUID,
    p_model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash'
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
    FROM get_user_daily_allocation(p_user_id, p_model_name);
    
    -- Check if user can make request
    IF NOT v_current_allocation.can_make_request THEN
        RETURN QUERY SELECT 
            false as success,
            0 as remaining_requests,
            v_current_allocation.allocated_requests_today,
            'Daily request limit exceeded' as message;
        RETURN;
    END IF;
    
    -- Increment user's daily usage in user_token_usage_summary
    INSERT INTO user_token_usage_summary (
        user_id, model_name, requests_made_today, last_reset_day
    ) VALUES (
        p_user_id, p_model_name, 1, CURRENT_DATE
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
    UPDATE system_daily_tracking 
    SET total_requests_used = total_requests_used + 1,
        updated_at = NOW()
    WHERE model_name = p_model_name 
    AND tracking_date = CURRENT_DATE;
    
    -- Return success with updated allocation
    SELECT * INTO v_current_allocation
    FROM get_user_daily_allocation(p_user_id, p_model_name);
    
    RETURN QUERY SELECT 
        true as success,
        v_current_allocation.requests_remaining_today,
        v_current_allocation.allocated_requests_today,
        'Request recorded successfully' as message;
END;
$$ LANGUAGE plpgsql;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_daily_allocations_user_date ON user_daily_allocations(user_id, allocation_date);
CREATE INDEX IF NOT EXISTS idx_user_daily_allocations_model_date ON user_daily_allocations(model_name, allocation_date);
CREATE INDEX IF NOT EXISTS idx_system_daily_tracking_model_date ON system_daily_tracking(model_name, tracking_date);

-- 9. Create view for easy dashboard queries
CREATE OR REPLACE VIEW daily_allocation_dashboard AS
SELECT 
    sdt.model_name,
    sdt.tracking_date,
    sdt.total_requests_available,
    sdt.total_requests_used,
    sdt.active_users_count,
    sdt.requests_per_user,
    ROUND((sdt.total_requests_used::NUMERIC / sdt.total_requests_available::NUMERIC) * 100, 2) as system_usage_percentage,
    (sdt.total_requests_available - sdt.total_requests_used) as requests_remaining,
    sdt.last_allocation_update
FROM system_daily_tracking sdt
WHERE sdt.tracking_date = CURRENT_DATE
ORDER BY sdt.model_name;

-- 10. Success message
SELECT 'Dynamic RPD Allocation schema created successfully!' as message,
       'Key features: Daily allocation based on active users, 30 request minimum guarantee, real-time reallocation' as features;