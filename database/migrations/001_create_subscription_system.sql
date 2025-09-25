-- Migration: Create Simple 2-Tier Subscription System
-- Date: 2025-01-23
-- Description: Creates tables for Free (10 messages/day) and Pro (100 messages/day) tiers

-- Create subscription tiers table
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE, -- 'free' or 'pro'
  display_name VARCHAR(100) NOT NULL, -- 'Free' or 'Pro'
  price_ngn DECIMAL(12,2) NOT NULL DEFAULT 0, -- Monthly price in Naira
  daily_message_limit INTEGER NOT NULL DEFAULT 10, -- Messages per day
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  
  -- Subscription Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'canceled', 'expired', 'payment_failed')),
  
  -- Billing Periods
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  
  -- Paystack Integration
  paystack_subscription_code VARCHAR(100),
  paystack_customer_code VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id) -- One active subscription per user
);

-- Create daily message usage tracking table
CREATE TABLE daily_message_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- YYYY-MM-DD format
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, date) -- One record per user per day
);

-- Create payment transactions table
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES user_subscriptions(id),
  
  -- Transaction Details
  amount_ngn DECIMAL(12,2) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'subscription'
    CHECK (transaction_type IN ('subscription', 'renewal', 'upgrade')),
  
  -- Paystack Data
  paystack_reference VARCHAR(255) NOT NULL UNIQUE,
  paystack_transaction_id VARCHAR(255),
  paystack_status VARCHAR(50),
  paystack_gateway_response TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add subscription tier column to users table
ALTER TABLE users ADD COLUMN subscription_tier_id UUID REFERENCES subscription_tiers(id);

-- Insert default tiers
INSERT INTO subscription_tiers (name, display_name, price_ngn, daily_message_limit, description) VALUES
('free', 'Free', 0, 10, 'Free tier with 10 messages per day'),
('pro', 'Pro', 3000, 100, 'Pro tier with 100 messages per day for ₦3,000/month');

-- Set all existing users to free tier by default
UPDATE users SET subscription_tier_id = (
  SELECT id FROM subscription_tiers WHERE name = 'free' LIMIT 1
) WHERE subscription_tier_id IS NULL;

-- Create free subscriptions for all existing users
INSERT INTO user_subscriptions (user_id, tier_id, status, current_period_start, current_period_end)
SELECT 
  u.id,
  st.id,
  'active',
  NOW(),
  NOW() + INTERVAL '100 years' -- Free tier never expires
FROM users u
CROSS JOIN subscription_tiers st
WHERE st.name = 'free'
AND NOT EXISTS (
  SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
);

-- Create indexes for performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_daily_message_usage_user_date ON daily_message_usage(user_id, date);
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_paystack_ref ON payment_transactions(paystack_reference);

-- Create function to get user's current tier
CREATE OR REPLACE FUNCTION get_user_tier(user_uuid UUID)
RETURNS TABLE(
  tier_name VARCHAR,
  daily_limit INTEGER,
  price_ngn DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.name,
    st.daily_message_limit,
    st.price_ngn
  FROM users u
  JOIN user_subscriptions us ON u.id = us.user_id
  JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE u.id = user_uuid
  AND us.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to check daily message quota
CREATE OR REPLACE FUNCTION check_daily_message_quota(user_uuid UUID)
RETURNS TABLE(
  can_send_message BOOLEAN,
  messages_used INTEGER,
  daily_limit INTEGER,
  messages_remaining INTEGER
) AS $$
DECLARE
  user_tier RECORD;
  usage_today INTEGER;
BEGIN
  -- Get user's tier info
  SELECT tier_name, daily_limit INTO user_tier
  FROM get_user_tier(user_uuid);
  
  IF user_tier IS NULL THEN
    -- Default to free tier if no subscription found
    user_tier.daily_limit := 10;
  END IF;
  
  -- Get today's usage
  SELECT COALESCE(message_count, 0) INTO usage_today
  FROM daily_message_usage
  WHERE user_id = user_uuid
  AND date = CURRENT_DATE;
  
  IF usage_today IS NULL THEN
    usage_today := 0;
  END IF;
  
  RETURN QUERY
  SELECT 
    (usage_today < user_tier.daily_limit) as can_send_message,
    usage_today as messages_used,
    user_tier.daily_limit as daily_limit,
    GREATEST(0, user_tier.daily_limit - usage_today) as messages_remaining;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment daily message count
CREATE OR REPLACE FUNCTION increment_daily_message_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_message_usage (user_id, date, message_count)
  VALUES (user_uuid, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    message_count = daily_message_usage.message_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;