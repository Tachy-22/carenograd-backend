-- Update free tier daily message limit from 20 to 10
UPDATE subscription_tiers 
SET daily_message_limit = 10,
    description = 'Free tier with 10 messages per day',
    updated_at = NOW()
WHERE name = 'free';

-- Verify the update
SELECT name, daily_message_limit, description 
FROM subscription_tiers 
WHERE name = 'free';