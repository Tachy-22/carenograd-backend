-- Migration script to add admin functionality columns to users table
-- Run this in your Supabase SQL Editor

-- Add new columns to users table for admin functionality
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance on admin queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Create additional indexes for chart analytics performance
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at);

-- Update existing users to have default values
UPDATE users 
SET 
  role = 'user',
  is_active = true,
  last_login_at = updated_at
WHERE role IS NULL OR is_active IS NULL;

-- Create your first admin user (replace with your email)
-- UPDATE users 
-- SET role = 'admin' 
-- WHERE email = 'your-admin-email@example.com';

-- Optional: Create RLS (Row Level Security) policies for admin access
-- Enable RLS on users table if not already enabled
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy to allow admins to see all users
-- CREATE POLICY "Admins can view all users" ON users
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM users 
--       WHERE id = auth.uid() 
--       AND role = 'admin' 
--       AND is_active = true
--     )
--   );

-- Policy to allow admins to update user roles and status
-- CREATE POLICY "Admins can update users" ON users
--   FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM users 
--       WHERE id = auth.uid() 
--       AND role = 'admin' 
--       AND is_active = true
--     )
--   );

-- Policy to allow users to see their own data
-- CREATE POLICY "Users can view own profile" ON users
--   FOR SELECT
--   USING (id = auth.uid());

-- Policy to allow users to update their own profile (except role and is_active)
-- CREATE POLICY "Users can update own profile" ON users
--   FOR UPDATE
--   USING (id = auth.uid())
--   WITH CHECK (
--     id = auth.uid() 
--     AND role = OLD.role 
--     AND is_active = OLD.is_active
--   );

COMMENT ON COLUMN users.role IS 'User role: user or admin';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';