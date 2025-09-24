-- Migration: Add Paystack Subscription Support for Recurring Billing
-- Date: 2025-01-23
-- Description: Updates subscription system to support Paystack recurring subscriptions

-- Add Paystack plan codes to subscription tiers
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS paystack_plan_code VARCHAR(100);

-- Add more subscription tracking fields
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS paystack_authorization_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS failed_payment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;

-- Update payment transactions to better track subscription payments
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS paystack_plan_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS subscription_cycle INTEGER DEFAULT 1; -- Which billing cycle this payment is for

-- Create subscription events table for tracking subscription lifecycle
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'renewed', 'failed', 'canceled', 'reactivated'
  event_data JSONB DEFAULT '{}',
  paystack_event_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for subscription events
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at);

-- Update the check_daily_message_quota function to handle grace periods
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
  subscription_record RECORD;
BEGIN
  -- Get user's subscription info including grace period
  SELECT 
    st.name as tier_name, 
    st.daily_message_limit as tier_daily_limit,
    us.status as subscription_status,
    us.current_period_end,
    us.grace_period_end
  INTO user_tier
  FROM users u
  LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status IN ('active', 'past_due')
  LEFT JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE u.id = user_uuid
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no active subscription, default to free tier
  IF user_tier IS NULL THEN
    SELECT name, daily_message_limit as tier_daily_limit INTO user_tier
    FROM subscription_tiers 
    WHERE name = 'free' 
    LIMIT 1;
    
    IF user_tier IS NULL THEN
      -- Fallback if no tiers exist yet
      user_tier.tier_daily_limit := 20;
    END IF;
  END IF;
  
  -- Check if subscription is expired but within grace period
  IF user_tier.subscription_status = 'past_due' AND 
     user_tier.grace_period_end IS NOT NULL AND 
     user_tier.grace_period_end > NOW() THEN
    -- Allow usage during grace period
    NULL;
  ELSIF user_tier.subscription_status = 'past_due' THEN
    -- Grace period expired, revert to free tier
    SELECT daily_message_limit INTO user_tier.tier_daily_limit
    FROM subscription_tiers 
    WHERE name = 'free' 
    LIMIT 1;
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
    (usage_today < user_tier.tier_daily_limit) as can_send_message,
    usage_today as messages_used,
    user_tier.tier_daily_limit as daily_limit,
    GREATEST(0, user_tier.tier_daily_limit - usage_today) as messages_remaining;
END;
$$ LANGUAGE plpgsql;

-- Function to handle subscription renewal
CREATE OR REPLACE FUNCTION renew_subscription(
  subscription_uuid UUID,
  new_period_start TIMESTAMP WITH TIME ZONE,
  new_period_end TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
BEGIN
  UPDATE user_subscriptions 
  SET 
    current_period_start = new_period_start,
    current_period_end = new_period_end,
    status = 'active',
    failed_payment_count = 0,
    grace_period_end = NULL,
    updated_at = NOW()
  WHERE id = subscription_uuid;
  
  -- Log renewal event
  INSERT INTO subscription_events (subscription_id, event_type, event_data)
  VALUES (subscription_uuid, 'renewed', json_build_object(
    'period_start', new_period_start,
    'period_end', new_period_end
  ));
END;
$$ LANGUAGE plpgsql;

-- Function to handle failed payments
CREATE OR REPLACE FUNCTION handle_failed_payment(
  subscription_uuid UUID,
  grace_period_days INTEGER DEFAULT 3
) RETURNS VOID AS $$
BEGIN
  UPDATE user_subscriptions 
  SET 
    status = 'past_due',
    failed_payment_count = failed_payment_count + 1,
    last_payment_attempt = NOW(),
    grace_period_end = NOW() + (grace_period_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE id = subscription_uuid;
  
  -- Log failed payment event
  INSERT INTO subscription_events (subscription_id, event_type, event_data)
  VALUES (subscription_uuid, 'failed', json_build_object(
    'failed_count', (SELECT failed_payment_count FROM user_subscriptions WHERE id = subscription_uuid),
    'grace_period_end', NOW() + (grace_period_days || ' days')::INTERVAL
  ));
END;
$$ LANGUAGE plpgsql;