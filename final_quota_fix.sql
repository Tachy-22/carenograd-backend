CREATE OR REPLACE FUNCTION check_daily_message_quota(user_uuid UUID)
RETURNS TABLE(
  can_send_message BOOLEAN,
  messages_used INTEGER,
  daily_limit INTEGER,
  messages_remaining INTEGER
) AS $$
DECLARE
  tier_daily_limit INTEGER;
  subscription_status VARCHAR(20);
  grace_period_end TIMESTAMP WITH TIME ZONE;
  usage_today INTEGER;
BEGIN
  -- Get user's subscription info including grace period - use explicit variables
  SELECT 
    st.daily_message_limit,
    us.status,
    us.grace_period_end
  INTO 
    tier_daily_limit,
    subscription_status,
    grace_period_end
  FROM users u
  LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status IN ('active', 'past_due')
  LEFT JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE u.id = user_uuid
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no active subscription, default to free tier
  IF tier_daily_limit IS NULL THEN
    SELECT daily_message_limit INTO tier_daily_limit
    FROM subscription_tiers 
    WHERE name = 'free' 
    LIMIT 1;
    
    IF tier_daily_limit IS NULL THEN
      -- Fallback if no tiers exist yet
      tier_daily_limit := 20;
    END IF;
    
    subscription_status := NULL;
    grace_period_end := NULL;
  END IF;
  
  -- Check if subscription is expired but within grace period
  IF subscription_status = 'past_due' AND 
     grace_period_end IS NOT NULL AND 
     grace_period_end > NOW() THEN
    -- Allow usage during grace period
    NULL;
  ELSIF subscription_status = 'past_due' THEN
    -- Grace period expired, revert to free tier
    SELECT daily_message_limit INTO tier_daily_limit
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
    (usage_today < tier_daily_limit) as can_send_message,
    usage_today as messages_used,
    tier_daily_limit as daily_limit,
    GREATEST(0, tier_daily_limit - usage_today) as messages_remaining;
END;
$$ LANGUAGE plpgsql;