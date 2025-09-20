-- QUICK FIX: Add missing google_id column to users table
-- This script adds the missing column that your application needs

-- Add the missing google_id column to the users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS picture VARCHAR(500),
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create unique constraint on google_id (after adding the column)
ALTER TABLE users 
ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);

-- Create index for google_id for performance
CREATE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id);

-- Success message
SELECT 'Missing columns added successfully! Your application should now work.' as status;