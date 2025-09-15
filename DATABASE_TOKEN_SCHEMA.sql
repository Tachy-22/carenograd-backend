-- Token Tracking Database Schema for PostgreSQL
-- Run this SQL in your PostgreSQL database

-- 1. Create token_pools table - manages global token allocations per model
CREATE TABLE IF NOT EXISTS token_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL UNIQUE,
    total_tokens_per_minute INTEGER NOT NULL,
    total_requests_per_minute INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user_token_quotas table - tracks allocated quotas per user
CREATE TABLE IF NOT EXISTS user_token_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    allocated_tokens_per_minute INTEGER NOT NULL,
    allocated_requests_per_minute INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_name)
);

-- 3. Create token_usage_records table - stores all token usage history
CREATE TABLE IF NOT EXISTS token_usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 1,
    conversation_id UUID,
    message_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create user_token_usage_summary table - real-time usage tracking per user per model
CREATE TABLE IF NOT EXISTS user_token_usage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    tokens_used_current_minute INTEGER NOT NULL DEFAULT 0,
    requests_made_current_minute INTEGER NOT NULL DEFAULT 0,
    tokens_used_current_hour INTEGER NOT NULL DEFAULT 0,
    requests_made_current_hour INTEGER NOT NULL DEFAULT 0,
    tokens_used_today INTEGER NOT NULL DEFAULT 0,
    requests_made_today INTEGER NOT NULL DEFAULT 0,
    last_reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_name)
);

-- 5. Create system_token_usage_summary table - system-wide usage tracking
CREATE TABLE IF NOT EXISTS system_token_usage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL UNIQUE,
    total_tokens_used_current_minute INTEGER NOT NULL DEFAULT 0,
    total_requests_made_current_minute INTEGER NOT NULL DEFAULT 0,
    total_tokens_used_current_hour INTEGER NOT NULL DEFAULT 0,
    total_requests_made_current_hour INTEGER NOT NULL DEFAULT 0,
    total_tokens_used_today INTEGER NOT NULL DEFAULT 0,
    total_requests_made_today INTEGER NOT NULL DEFAULT 0,
    active_users_count INTEGER NOT NULL DEFAULT 0,
    last_reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_usage_records_user_id ON token_usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_records_model_name ON token_usage_records(model_name);
CREATE INDEX IF NOT EXISTS idx_token_usage_records_created_at ON token_usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_records_user_model_time ON token_usage_records(user_id, model_name, created_at);

CREATE INDEX IF NOT EXISTS idx_user_token_usage_summary_user_id ON user_token_usage_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_usage_summary_model_name ON user_token_usage_summary(model_name);

CREATE INDEX IF NOT EXISTS idx_user_token_quotas_user_id ON user_token_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_quotas_model_name ON user_token_quotas(model_name);

-- 7. Insert default token pools for Gemini models
INSERT INTO token_pools (model_name, total_tokens_per_minute, total_requests_per_minute) VALUES
('gemini-2.0-flash', 1000000, 15),
('gemini-1.5-flash', 250000, 15),
('gemini-1.5-flash-8b', 250000, 15),
('gemini-1.5-flash-002', 250000, 15),
('gemini-2.5-flash-lite', 250000, 15),
('gemini-2.5-flash', 250000, 10)
ON CONFLICT (model_name) DO UPDATE SET
    total_tokens_per_minute = EXCLUDED.total_tokens_per_minute,
    total_requests_per_minute = EXCLUDED.total_requests_per_minute,
    updated_at = NOW();

-- 8. Insert default system usage summary records
INSERT INTO system_token_usage_summary (model_name) VALUES
('gemini-2.0-flash'),
('gemini-1.5-flash'),
('gemini-1.5-flash-8b'),
('gemini-1.5-flash-002'),
('gemini-2.5-flash-lite'),
('gemini-2.5-flash')
ON CONFLICT (model_name) DO NOTHING;

-- 9. Create function to calculate and allocate user quotas
CREATE OR REPLACE FUNCTION allocate_user_quotas()
RETURNS VOID AS $$
DECLARE
    model_record RECORD;
    active_user_count INTEGER;
    tokens_per_user INTEGER;
    requests_per_user INTEGER;
BEGIN
    -- Get count of active users (users who made requests in last 24 hours)
    SELECT COUNT(DISTINCT user_id) INTO active_user_count
    FROM token_usage_records
    WHERE created_at > NOW() - INTERVAL '24 hours';
    
    -- If no active users, set to 1 to avoid division by zero
    IF active_user_count = 0 THEN
        active_user_count := 1;
    END IF;
    
    -- Update active users count in system summary
    UPDATE system_token_usage_summary
    SET active_users_count = active_user_count,
        updated_at = NOW();
    
    -- Allocate quotas for each model
    FOR model_record IN SELECT model_name, total_tokens_per_minute, total_requests_per_minute 
                       FROM token_pools WHERE is_active = true
    LOOP
        tokens_per_user := model_record.total_tokens_per_minute / active_user_count;
        requests_per_user := model_record.total_requests_per_minute / active_user_count;
        
        -- Update or insert quota allocations for active users
        INSERT INTO user_token_quotas (user_id, model_name, allocated_tokens_per_minute, allocated_requests_per_minute)
        SELECT DISTINCT user_id, model_record.model_name, tokens_per_user, requests_per_user
        FROM token_usage_records
        WHERE created_at > NOW() - INTERVAL '24 hours'
        ON CONFLICT (user_id, model_name) DO UPDATE SET
            allocated_tokens_per_minute = EXCLUDED.allocated_tokens_per_minute,
            allocated_requests_per_minute = EXCLUDED.allocated_requests_per_minute,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to record token usage and update summaries
CREATE OR REPLACE FUNCTION record_token_usage(
    p_user_id UUID,
    p_model_name VARCHAR(100),
    p_prompt_tokens INTEGER,
    p_completion_tokens INTEGER,
    p_total_tokens INTEGER,
    p_conversation_id UUID DEFAULT NULL,
    p_message_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    current_minute TIMESTAMP;
    current_hour TIMESTAMP;
    current_day DATE;
BEGIN
    -- Calculate time boundaries
    current_minute := DATE_TRUNC('minute', NOW());
    current_hour := DATE_TRUNC('hour', NOW());
    current_day := DATE_TRUNC('day', NOW())::DATE;
    
    -- Insert usage record
    INSERT INTO token_usage_records (
        user_id, model_name, prompt_tokens, completion_tokens, total_tokens,
        conversation_id, message_id
    ) VALUES (
        p_user_id, p_model_name, p_prompt_tokens, p_completion_tokens, p_total_tokens,
        p_conversation_id, p_message_id
    );
    
    -- Update or insert user usage summary
    INSERT INTO user_token_usage_summary (
        user_id, model_name, 
        tokens_used_current_minute, requests_made_current_minute,
        tokens_used_current_hour, requests_made_current_hour,
        tokens_used_today, requests_made_today,
        last_reset_minute, last_reset_hour, last_reset_day
    ) VALUES (
        p_user_id, p_model_name,
        p_total_tokens, 1,
        p_total_tokens, 1,
        p_total_tokens, 1,
        current_minute, current_hour, current_day
    )
    ON CONFLICT (user_id, model_name) DO UPDATE SET
        -- Reset counters if time period changed
        tokens_used_current_minute = CASE 
            WHEN user_token_usage_summary.last_reset_minute < current_minute 
            THEN p_total_tokens 
            ELSE user_token_usage_summary.tokens_used_current_minute + p_total_tokens
        END,
        requests_made_current_minute = CASE 
            WHEN user_token_usage_summary.last_reset_minute < current_minute 
            THEN 1 
            ELSE user_token_usage_summary.requests_made_current_minute + 1
        END,
        tokens_used_current_hour = CASE 
            WHEN user_token_usage_summary.last_reset_hour < current_hour 
            THEN p_total_tokens 
            ELSE user_token_usage_summary.tokens_used_current_hour + p_total_tokens
        END,
        requests_made_current_hour = CASE 
            WHEN user_token_usage_summary.last_reset_hour < current_hour 
            THEN 1 
            ELSE user_token_usage_summary.requests_made_current_hour + 1
        END,
        tokens_used_today = CASE 
            WHEN user_token_usage_summary.last_reset_day::DATE < current_day 
            THEN p_total_tokens 
            ELSE user_token_usage_summary.tokens_used_today + p_total_tokens
        END,
        requests_made_today = CASE 
            WHEN user_token_usage_summary.last_reset_day::DATE < current_day 
            THEN 1 
            ELSE user_token_usage_summary.requests_made_today + 1
        END,
        last_reset_minute = CASE 
            WHEN user_token_usage_summary.last_reset_minute < current_minute 
            THEN current_minute 
            ELSE user_token_usage_summary.last_reset_minute
        END,
        last_reset_hour = CASE 
            WHEN user_token_usage_summary.last_reset_hour < current_hour 
            THEN current_hour 
            ELSE user_token_usage_summary.last_reset_hour
        END,
        last_reset_day = CASE 
            WHEN user_token_usage_summary.last_reset_day::DATE < current_day 
            THEN current_day 
            ELSE user_token_usage_summary.last_reset_day
        END,
        updated_at = NOW();
    
    -- Update system usage summary
    INSERT INTO system_token_usage_summary (
        model_name,
        total_tokens_used_current_minute, total_requests_made_current_minute,
        total_tokens_used_current_hour, total_requests_made_current_hour,
        total_tokens_used_today, total_requests_made_today,
        last_reset_minute, last_reset_hour, last_reset_day
    ) VALUES (
        p_model_name,
        p_total_tokens, 1,
        p_total_tokens, 1,
        p_total_tokens, 1,
        current_minute, current_hour, current_day
    )
    ON CONFLICT (model_name) DO UPDATE SET
        -- Reset counters if time period changed
        total_tokens_used_current_minute = CASE 
            WHEN system_token_usage_summary.last_reset_minute < current_minute 
            THEN p_total_tokens 
            ELSE system_token_usage_summary.total_tokens_used_current_minute + p_total_tokens
        END,
        total_requests_made_current_minute = CASE 
            WHEN system_token_usage_summary.last_reset_minute < current_minute 
            THEN 1 
            ELSE system_token_usage_summary.total_requests_made_current_minute + 1
        END,
        total_tokens_used_current_hour = CASE 
            WHEN system_token_usage_summary.last_reset_hour < current_hour 
            THEN p_total_tokens 
            ELSE system_token_usage_summary.total_tokens_used_current_hour + p_total_tokens
        END,
        total_requests_made_current_hour = CASE 
            WHEN system_token_usage_summary.last_reset_hour < current_hour 
            THEN 1 
            ELSE system_token_usage_summary.total_requests_made_current_hour + 1
        END,
        total_tokens_used_today = CASE 
            WHEN system_token_usage_summary.last_reset_day::DATE < current_day 
            THEN p_total_tokens 
            ELSE system_token_usage_summary.total_tokens_used_today + p_total_tokens
        END,
        total_requests_made_today = CASE 
            WHEN system_token_usage_summary.last_reset_day::DATE < current_day 
            THEN 1 
            ELSE system_token_usage_summary.total_requests_made_today + 1
        END,
        last_reset_minute = CASE 
            WHEN system_token_usage_summary.last_reset_minute < current_minute 
            THEN current_minute 
            ELSE system_token_usage_summary.last_reset_minute
        END,
        last_reset_hour = CASE 
            WHEN system_token_usage_summary.last_reset_hour < current_hour 
            THEN current_hour 
            ELSE system_token_usage_summary.last_reset_hour
        END,
        last_reset_day = CASE 
            WHEN system_token_usage_summary.last_reset_day::DATE < current_day 
            THEN current_day 
            ELSE system_token_usage_summary.last_reset_day
        END,
        updated_at = NOW();
    
    -- Reallocate quotas after usage update
    PERFORM allocate_user_quotas();
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to get user quota status (for frontend warnings)
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
    warning_level VARCHAR(20),
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
            ELSE 0
        END as quota_percentage_used,
        CASE 
            WHEN COALESCE(u.tokens_used_current_minute, 0) >= q.allocated_tokens_per_minute * 0.95 THEN 'CRITICAL'
            WHEN COALESCE(u.tokens_used_current_minute, 0) >= q.allocated_tokens_per_minute * 0.80 THEN 'HIGH'
            WHEN COALESCE(u.tokens_used_current_minute, 0) >= q.allocated_tokens_per_minute * 0.60 THEN 'MEDIUM'
            ELSE 'LOW'
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

-- 12. Create function to get system overview
CREATE OR REPLACE FUNCTION get_system_token_overview()
RETURNS TABLE (
    model_name VARCHAR(100),
    total_tokens_per_minute INTEGER,
    total_tokens_used_current_minute INTEGER,
    system_tokens_remaining INTEGER,
    active_users_count INTEGER,
    tokens_per_user INTEGER,
    system_usage_percentage NUMERIC(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.model_name,
        p.total_tokens_per_minute,
        COALESCE(s.total_tokens_used_current_minute, 0) as total_tokens_used_current_minute,
        GREATEST(0, p.total_tokens_per_minute - COALESCE(s.total_tokens_used_current_minute, 0)) as system_tokens_remaining,
        COALESCE(s.active_users_count, 0) as active_users_count,
        CASE 
            WHEN COALESCE(s.active_users_count, 0) > 0 
            THEN p.total_tokens_per_minute / COALESCE(s.active_users_count, 1)
            ELSE p.total_tokens_per_minute
        END as tokens_per_user,
        CASE 
            WHEN p.total_tokens_per_minute > 0 
            THEN ROUND((COALESCE(s.total_tokens_used_current_minute, 0)::NUMERIC / p.total_tokens_per_minute::NUMERIC) * 100, 2)
            ELSE 0
        END as system_usage_percentage
    FROM token_pools p
    LEFT JOIN system_token_usage_summary s ON p.model_name = s.model_name
    WHERE p.is_active = true
    ORDER BY p.model_name;
END;
$$ LANGUAGE plpgsql;

-- 13. Create cleanup function to remove old usage records (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_token_records()
RETURNS VOID AS $$
BEGIN
    -- Delete usage records older than 7 days
    DELETE FROM token_usage_records 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Update vacuum analyze for performance
    VACUUM ANALYZE token_usage_records;
    VACUUM ANALYZE user_token_usage_summary;
    VACUUM ANALYZE system_token_usage_summary;
END;
$$ LANGUAGE plpgsql;

-- 14. Initial quota allocation
SELECT allocate_user_quotas();

-- Success message
SELECT 'Token tracking database schema created successfully!' as message;