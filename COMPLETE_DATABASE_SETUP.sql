-- COMPLETE DATABASE SETUP SCRIPT
-- This script sets up the ENTIRE database schema for your project from scratch
-- Run this after deleting your entire database

-- ============================================================================
-- EXTENSIONS & BASIC SETUP
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================================
-- 1. CORE USER MANAGEMENT TABLES
-- ============================================================================

-- Users table for Google OAuth authentication and profile management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture VARCHAR(500),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);

-- ============================================================================
-- 2. DOCUMENT & RAG SYSTEM TABLES
-- ============================================================================

-- Documents table for user-specific file uploads
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks for embeddings (user-specific)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536), -- OpenAI ada-002 embedding size
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes for documents and chunks
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_upload_status_idx ON documents(upload_status);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at);

CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 3. TOKEN TRACKING & QUOTA SYSTEM TABLES
-- ============================================================================

-- Token pools - manages global token allocations per model
CREATE TABLE IF NOT EXISTS token_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL UNIQUE,
    total_tokens_per_minute INTEGER NOT NULL DEFAULT 1000000,
    total_requests_per_minute INTEGER NOT NULL DEFAULT 15,
    total_requests_per_day INTEGER NOT NULL DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User token quotas - tracks allocated quotas per user
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

-- Token usage records - stores all token usage history
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

-- User token usage summary - real-time usage tracking per user per model
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

-- System token usage summary - system-wide usage tracking
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

-- ============================================================================
-- 4. DYNAMIC ALLOCATION SYSTEM TABLES
-- ============================================================================

-- User daily allocations - tracks dynamic daily request allocation
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

-- System daily tracking - system-wide daily tracking
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

-- ============================================================================
-- 5. CONVERSATION & CHAT SYSTEM TABLES
-- ============================================================================

-- Conversations table to group messages  
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table for chat history
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. PERFORMANCE INDEXES
-- ============================================================================

-- Token tracking indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_records_user_id ON token_usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_records_model_name ON token_usage_records(model_name);
CREATE INDEX IF NOT EXISTS idx_token_usage_records_created_at ON token_usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_records_user_model_time ON token_usage_records(user_id, model_name, created_at);

CREATE INDEX IF NOT EXISTS idx_user_token_usage_summary_user_id ON user_token_usage_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_usage_summary_model_name ON user_token_usage_summary(model_name);

CREATE INDEX IF NOT EXISTS idx_user_token_quotas_user_id ON user_token_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_quotas_model_name ON user_token_quotas(model_name);

-- Dynamic allocation indexes
CREATE INDEX IF NOT EXISTS idx_user_daily_allocations_user_date ON user_daily_allocations(user_id, allocation_date);
CREATE INDEX IF NOT EXISTS idx_user_daily_allocations_model_date ON user_daily_allocations(model_name, allocation_date);
CREATE INDEX IF NOT EXISTS idx_system_daily_tracking_model_date ON system_daily_tracking(model_name, tracking_date);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================================================
-- 7. INITIAL DATA & CONFIGURATION
-- ============================================================================

-- Insert default token pools for Gemini models (15 API key setup)
INSERT INTO token_pools (model_name, total_tokens_per_minute, total_requests_per_minute, total_requests_per_day) VALUES
('gemini-2.5-flash', 1000000 * 15, 15 * 15, 200 * 15),  -- 15M TPM, 225 RPM, 3000 RPD
('gemini-1.5-flash', 250000 * 15, 15 * 15, 200 * 15),   -- Scaled for 15 keys
('gemini-1.5-flash-8b', 250000 * 15, 15 * 15, 200 * 15),
('gemini-1.5-flash-002', 250000 * 15, 15 * 15, 200 * 15),
('gemini-2.5-flash-lite', 250000 * 15, 15 * 15, 200 * 15),
('gemini-2.5-flash', 250000 * 15, 10 * 15, 200 * 15)    -- Lower RPM for this model
ON CONFLICT (model_name) DO UPDATE SET
    total_tokens_per_minute = EXCLUDED.total_tokens_per_minute,
    total_requests_per_minute = EXCLUDED.total_requests_per_minute,
    total_requests_per_day = EXCLUDED.total_requests_per_day,
    updated_at = NOW();

-- Insert default system usage summary records
INSERT INTO system_token_usage_summary (model_name) VALUES
('gemini-2.5-flash'),
('gemini-1.5-flash'),
('gemini-1.5-flash-8b'),
('gemini-1.5-flash-002'),
('gemini-2.5-flash-lite'),
('gemini-2.5-flash')
ON CONFLICT (model_name) DO NOTHING;

-- Initialize system tracking for gemini-2.5-flash with 15 API keys
INSERT INTO system_daily_tracking (model_name, total_requests_available) VALUES 
('gemini-2.5-flash', 200 * 15) -- 15 API keys × 200 RPD = 3000 total
ON CONFLICT (model_name, tracking_date) DO NOTHING;

-- ============================================================================
-- 8. RAG SYSTEM FUNCTIONS
-- ============================================================================

-- User-specific document search function
CREATE OR REPLACE FUNCTION match_user_document_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.78,
    match_count int DEFAULT 10,
    user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_chunks.id,
        document_chunks.document_id,
        document_chunks.content,
        document_chunks.metadata,
        (document_chunks.embedding <#> query_embedding) * -1 AS similarity
    FROM document_chunks
    WHERE 
        (user_id_filter IS NULL OR document_chunks.user_id = user_id_filter)
        AND (document_chunks.embedding <#> query_embedding) * -1 > match_threshold
    ORDER BY document_chunks.embedding <#> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- 9. DROP ALL EXISTING FUNCTIONS FIRST (AVOID CONFLICTS)
-- ============================================================================

-- Drop all possible function variations to avoid conflicts
DROP FUNCTION IF EXISTS calculate_daily_allocation(VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(p_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(model_param VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(target_model VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS calculate_daily_allocation(model_input VARCHAR(100)) CASCADE;

DROP FUNCTION IF EXISTS get_user_daily_allocation(UUID, VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(p_user_id UUID, p_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(input_user_id UUID, input_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(user_param UUID, model_param VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(target_user_id UUID, target_model VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_allocation(user_input UUID, model_input VARCHAR(100)) CASCADE;

DROP FUNCTION IF EXISTS record_daily_request_usage(UUID, VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(p_user_id UUID, p_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(input_user_id UUID, input_model_name VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(user_param UUID, model_param VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(target_user_id UUID, target_model VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS record_daily_request_usage(user_input UUID, model_input VARCHAR(100)) CASCADE;

DROP FUNCTION IF EXISTS match_user_document_chunks(vector(1536), float, int, uuid) CASCADE;
DROP FUNCTION IF EXISTS allocate_user_quotas() CASCADE;
DROP FUNCTION IF EXISTS record_token_usage(UUID, VARCHAR(100), INTEGER, INTEGER, INTEGER, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_quota_status(UUID, VARCHAR(100)) CASCADE;
DROP FUNCTION IF EXISTS get_system_token_overview() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_token_records() CASCADE;

-- ============================================================================
-- 10. DYNAMIC ALLOCATION FUNCTIONS (ULTRA FIX VERSION)
-- ============================================================================

-- Calculate daily allocation function
CREATE OR REPLACE FUNCTION calculate_daily_allocation(model_input VARCHAR(100) DEFAULT 'gemini-2.5-flash')
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

-- Get user daily allocation function
CREATE OR REPLACE FUNCTION get_user_daily_allocation(
    user_input UUID,
    model_input VARCHAR(100) DEFAULT 'gemini-2.5-flash'
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

-- Record daily request usage function
CREATE OR REPLACE FUNCTION record_daily_request_usage(
    user_input UUID,
    model_input VARCHAR(100) DEFAULT 'gemini-2.5-flash'
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

-- ============================================================================
-- 11. LEGACY TOKEN TRACKING FUNCTIONS
-- ============================================================================

-- Legacy function to allocate user quotas
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

-- Legacy function to record token usage
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
    
    -- Update or insert user usage summary with time-based resets
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
        -- Reset counters if time period changed, otherwise increment
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
    
    -- Reallocate quotas after usage update
    PERFORM allocate_user_quotas();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. UTILITY & DASHBOARD FUNCTIONS
-- ============================================================================

-- Get user quota status function (legacy)
CREATE OR REPLACE FUNCTION get_user_quota_status(p_user_id UUID, p_model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash')
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

-- System overview function
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

-- Daily allocation dashboard view
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

-- Cleanup function for old records
CREATE OR REPLACE FUNCTION cleanup_old_token_records()
RETURNS VOID AS $$
BEGIN
    -- Delete usage records older than 7 days
    DELETE FROM token_usage_records 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete old daily allocation records older than 30 days
    DELETE FROM user_daily_allocations 
    WHERE allocation_date < CURRENT_DATE - INTERVAL '30 days';
    
    DELETE FROM system_daily_tracking 
    WHERE tracking_date < CURRENT_DATE - INTERVAL '30 days';
    
    -- Update vacuum analyze for performance
    VACUUM ANALYZE token_usage_records;
    VACUUM ANALYZE user_token_usage_summary;
    VACUUM ANALYZE system_token_usage_summary;
    VACUUM ANALYZE user_daily_allocations;
    VACUUM ANALYZE system_daily_tracking;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) SETUP
-- ============================================================================

-- Enable RLS on user-specific tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_token_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_token_usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_allocations ENABLE ROW LEVEL SECURITY;

-- Document RLS policies
CREATE POLICY "Users can view their own documents" ON documents
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON documents
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON documents
    FOR DELETE USING (auth.uid() = user_id);

-- Document chunks RLS policies
CREATE POLICY "Users can view their own chunks" ON document_chunks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chunks" ON document_chunks
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chunks" ON document_chunks
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chunks" ON document_chunks
    FOR DELETE USING (auth.uid() = user_id);

-- Conversation RLS policies
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Messages RLS policies
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages" ON messages
    FOR DELETE USING (auth.uid() = user_id);

-- Token quota RLS policies
CREATE POLICY "Users can view their own quotas" ON user_token_quotas
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own quotas" ON user_token_quotas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Token usage records RLS policies
CREATE POLICY "Users can view their own usage records" ON token_usage_records
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own usage records" ON token_usage_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User token usage summary RLS policies
CREATE POLICY "Users can view their own usage summary" ON user_token_usage_summary
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own usage summary" ON user_token_usage_summary
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User daily allocations RLS policies
CREATE POLICY "Users can view their own daily allocations" ON user_daily_allocations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own daily allocations" ON user_daily_allocations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 14. INITIAL SETUP & VERIFICATION
-- ============================================================================

-- Run initial quota allocation
SELECT allocate_user_quotas();

-- Force schema refresh for PostgREST
SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- 15. SUCCESS VERIFICATION
-- ============================================================================

-- Verify all tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 'documents', 'document_chunks', 'conversations', 'messages',
    'token_pools', 'user_token_quotas', 'token_usage_records', 
    'user_token_usage_summary', 'system_token_usage_summary',
    'user_daily_allocations', 'system_daily_tracking'
)
ORDER BY table_name;

-- Verify all functions exist
SELECT 
    proname as function_name,
    proargnames as arguments
FROM pg_proc 
WHERE proname IN (
    'match_user_document_chunks',
    'calculate_daily_allocation',
    'get_user_daily_allocation', 
    'record_daily_request_usage',
    'allocate_user_quotas',
    'record_token_usage',
    'get_user_quota_status',
    'get_system_token_overview',
    'cleanup_old_token_records'
)
ORDER BY proname;

-- Verify extensions
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'vector', 'pg_stat_statements')
ORDER BY extname;

-- Success message with summary
SELECT 
    'COMPLETE DATABASE SETUP SUCCESSFUL!' as status,
    '🎯 All tables, indexes, functions, and RLS policies created' as tables_status,
    '🔐 Row Level Security enabled for user isolation' as security_status,
    '📊 Dynamic allocation system ready with 15 API key support' as allocation_status,
    '🤖 RAG system ready with vector search capabilities' as rag_status,
    '⚡ Performance indexes created for optimal queries' as performance_status,
    'Your database is now ready for the complete AI agent system!' as message;