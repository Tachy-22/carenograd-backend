-- Multi-API Allocation System Database Schema
-- This schema supports dynamic request allocation and tracking for multiple API providers

-- Drop existing objects if they exist
DROP VIEW IF EXISTS v_daily_allocation_summary;
DROP FUNCTION IF EXISTS cleanup_old_allocations(INTEGER);
DROP FUNCTION IF EXISTS calculate_dynamic_allocation(INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_requests_today(UUID, VARCHAR, DATE);
DROP FUNCTION IF EXISTS get_total_requests_used(DATE, VARCHAR);
DROP FUNCTION IF EXISTS get_active_users_count(DATE, VARCHAR);
DROP FUNCTION IF EXISTS increment_user_requests(UUID, VARCHAR, DATE);
DROP TABLE IF EXISTS user_daily_allocations;

-- Create user_daily_allocations table for tracking daily usage
CREATE TABLE user_daily_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  requests_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per model per day
  UNIQUE(user_id, model_name, date)
);

-- Add indexes for performance
CREATE INDEX idx_user_daily_allocations_user_date ON user_daily_allocations(user_id, date);
CREATE INDEX idx_user_daily_allocations_model_date ON user_daily_allocations(model_name, date);
CREATE INDEX idx_user_daily_allocations_date ON user_daily_allocations(date);

-- Create function to increment user requests
CREATE OR REPLACE FUNCTION increment_user_requests(
  p_user_id UUID,
  p_model_name VARCHAR(100),
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert new record or increment existing
  INSERT INTO user_daily_allocations (user_id, model_name, date, requests_used)
  VALUES (p_user_id, p_model_name, p_date, 1)
  ON CONFLICT (user_id, model_name, date)
  DO UPDATE SET 
    requests_used = user_daily_allocations.requests_used + 1,
    updated_at = NOW();
END;
$$;

-- Create function to get active users count for a specific date
CREATE OR REPLACE FUNCTION get_active_users_count(
  p_date DATE,
  p_model_name VARCHAR(100) DEFAULT 'gemini-2.5'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO user_count
  FROM user_daily_allocations
  WHERE date = p_date 
    AND model_name = p_model_name
    AND requests_used > 0;
  
  RETURN COALESCE(user_count, 0);
END;
$$;

-- Create function to get total requests used for a specific date and model
CREATE OR REPLACE FUNCTION get_total_requests_used(
  p_date DATE,
  p_model_name VARCHAR(100) DEFAULT 'gemini-2.5'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_requests INTEGER;
BEGIN
  SELECT COALESCE(SUM(requests_used), 0)
  INTO total_requests
  FROM user_daily_allocations
  WHERE date = p_date 
    AND model_name = p_model_name;
  
  RETURN total_requests;
END;
$$;

-- Create function to get user's requests for a specific date
CREATE OR REPLACE FUNCTION get_user_requests_today(
  p_user_id UUID,
  p_model_name VARCHAR(100) DEFAULT 'gemini-2.5',
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_requests INTEGER;
BEGIN
  SELECT COALESCE(requests_used, 0)
  INTO user_requests
  FROM user_daily_allocations
  WHERE user_id = p_user_id 
    AND model_name = p_model_name
    AND date = p_date;
  
  RETURN user_requests;
END;
$$;

-- Create function to calculate dynamic allocation
CREATE OR REPLACE FUNCTION calculate_dynamic_allocation(
  p_active_users INTEGER,
  p_total_quota INTEGER DEFAULT 3000,
  p_min_requests INTEGER DEFAULT 30,
  p_max_users INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  effective_users INTEGER;
  calculated_allocation INTEGER;
BEGIN
  -- Handle zero users case
  IF p_active_users = 0 THEN
    RETURN p_total_quota;
  END IF;
  
  -- Limit users to prevent too low allocation
  effective_users := LEAST(p_active_users, p_max_users);
  
  -- Calculate allocation with minimum guarantee
  calculated_allocation := FLOOR(p_total_quota / effective_users);
  
  -- Ensure minimum requests per user
  RETURN GREATEST(calculated_allocation, p_min_requests);
END;
$$;

-- Create view for easy allocation monitoring
CREATE VIEW v_daily_allocation_summary AS
SELECT 
  date,
  model_name,
  COUNT(DISTINCT user_id) as active_users,
  SUM(requests_used) as total_requests_used,
  ROUND(AVG(requests_used)::numeric, 2) as avg_requests_per_user,
  MAX(requests_used) as max_requests_by_user,
  MIN(requests_used) as min_requests_by_user
FROM user_daily_allocations
WHERE requests_used > 0
GROUP BY date, model_name
ORDER BY date DESC, model_name;

-- Create function to clean up old allocation data (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_allocations(
  p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_daily_allocations
  WHERE date < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant necessary permissions for the application
GRANT ALL ON TABLE user_daily_allocations TO authenticated;
GRANT ALL ON TABLE user_daily_allocations TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION increment_user_requests(UUID, VARCHAR, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_user_requests(UUID, VARCHAR, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_active_users_count(DATE, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_count(DATE, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_total_requests_used(DATE, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_requests_used(DATE, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_user_requests_today(UUID, VARCHAR, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_requests_today(UUID, VARCHAR, DATE) TO anon;
GRANT EXECUTE ON FUNCTION calculate_dynamic_allocation(INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_dynamic_allocation(INTEGER, INTEGER, INTEGER, INTEGER) TO anon;

-- Grant access to the view
GRANT SELECT ON v_daily_allocation_summary TO authenticated;
GRANT SELECT ON v_daily_allocation_summary TO anon;

-- Create sample data for testing (optional)
-- INSERT INTO user_daily_allocations (user_id, model_name, date, requests_used) VALUES
-- ('550e8400-e29b-41d4-a716-446655440001', 'gemini-2.5', CURRENT_DATE, 25),
-- ('550e8400-e29b-41d4-a716-446655440002', 'gemini-2.5', CURRENT_DATE, 45),
-- ('550e8400-e29b-41d4-a716-446655440003', 'gemini-2.5', CURRENT_DATE, 12);

-- Display schema creation summary
SELECT 'Multi-API Allocation Schema Created Successfully!' as status;