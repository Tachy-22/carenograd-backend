-- FORCE ADD MISSING COLUMNS - This will definitely fix the google_id error
-- This script forcefully adds all missing columns to your existing users table

-- First, let's see what columns exist in your users table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add missing columns one by one (will ignore if they already exist)
DO $$
BEGIN
    -- Add google_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'google_id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN google_id VARCHAR(255);
        RAISE NOTICE 'Added google_id column';
    ELSE
        RAISE NOTICE 'google_id column already exists';
    END IF;

    -- Add name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name' AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(255);
        RAISE NOTICE 'Added name column';
    ELSE
        RAISE NOTICE 'name column already exists';
    END IF;

    -- Add picture column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'picture' AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN picture VARCHAR(500);
        RAISE NOTICE 'Added picture column';
    ELSE
        RAISE NOTICE 'picture column already exists';
    END IF;

    -- Add access_token column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'access_token' AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN access_token TEXT;
        RAISE NOTICE 'Added access_token column';
    ELSE
        RAISE NOTICE 'access_token column already exists';
    END IF;

    -- Add refresh_token column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'refresh_token' AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN refresh_token TEXT;
        RAISE NOTICE 'Added refresh_token column';
    ELSE
        RAISE NOTICE 'refresh_token column already exists';
    END IF;

    -- Add token_expires_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'token_expires_at' AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added token_expires_at column';
    ELSE
        RAISE NOTICE 'token_expires_at column already exists';
    END IF;
END $$;

-- Create unique constraint on google_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_name = 'users_google_id_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);
        RAISE NOTICE 'Added unique constraint on google_id';
    ELSE
        RAISE NOTICE 'google_id unique constraint already exists';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add unique constraint on google_id: %', SQLERRM;
END $$;

-- Create index on google_id if it doesn't exist
CREATE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id);

-- Show final table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Success message
SELECT 'All missing columns added successfully! Your application should now work.' as status;