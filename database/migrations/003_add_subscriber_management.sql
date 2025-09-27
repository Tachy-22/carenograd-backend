-- Migration: Add Subscriber Management and Email Campaign System
-- Date: 2025-01-23
-- Description: Creates tables for subscriber management, email campaigns, and email tracking

-- Create subscriber management table
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for manually added subscribers
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  source VARCHAR(20) NOT NULL DEFAULT 'manual_add'
    CHECK (source IN ('user_registration', 'manual_add', 'imported')),
  metadata JSONB DEFAULT '{}', -- Custom fields, tags, segments
  unsubscribe_token VARCHAR(255) UNIQUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables JSONB DEFAULT '[]', -- Array of variable names used in template
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email campaigns table
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  html_content TEXT, -- Can override template content
  text_content TEXT,
  recipient_filter JSONB DEFAULT '{}', -- Filter criteria for recipients
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email logs table for tracking individual emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed')),
  gmail_message_id VARCHAR(255), -- Gmail API message ID
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_source ON subscribers(source);
CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers(created_at);

CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_default ON email_templates(is_default);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON email_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_subscriber_id ON email_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- Function to generate unsubscribe tokens
CREATE OR REPLACE FUNCTION generate_unsubscribe_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unsubscribe_token IS NULL THEN
    NEW.unsubscribe_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate unsubscribe tokens
DROP TRIGGER IF EXISTS trigger_generate_unsubscribe_token ON subscribers;
CREATE TRIGGER trigger_generate_unsubscribe_token
  BEFORE INSERT ON subscribers
  FOR EACH ROW
  EXECUTE FUNCTION generate_unsubscribe_token();

-- Function to sync existing users to subscribers
CREATE OR REPLACE FUNCTION sync_users_to_subscribers()
RETURNS INTEGER AS $$
DECLARE
  synced_count INTEGER := 0;
BEGIN
  INSERT INTO subscribers (email, name, user_id, source, subscribed_at)
  SELECT 
    u.email,
    u.name,
    u.id,
    'user_registration',
    u.created_at
  FROM users u
  WHERE u.email NOT IN (SELECT email FROM subscribers)
  AND u.is_active = true;
  
  GET DIAGNOSTICS synced_count = ROW_COUNT;
  RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically add new users as subscribers
CREATE OR REPLACE FUNCTION auto_add_user_subscriber()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscribers (email, name, user_id, source, subscribed_at)
  VALUES (NEW.email, NEW.name, NEW.id, 'user_registration', NEW.created_at)
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-add users as subscribers
DROP TRIGGER IF EXISTS trigger_auto_add_subscriber ON users;
CREATE TRIGGER trigger_auto_add_subscriber
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_user_subscriber();

-- Sync existing users to subscribers
SELECT sync_users_to_subscribers();

-- Insert default email template
INSERT INTO email_templates (name, subject, html_content, text_content, variables, is_default) VALUES
('Default Announcement', 'Important Update from {{company_name}}', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 8px; margin-top: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .unsubscribe { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{company_name}}</h1>
    </div>
    <div class="content">
        <h2>Hello {{name}}!</h2>
        <p>{{message_body}}</p>
        {{#if call_to_action_url}}
        <p style="text-align: center; margin: 30px 0;">
            <a href="{{call_to_action_url}}" class="button">{{call_to_action_text}}</a>
        </p>
        {{/if}}
    </div>
    <div class="footer">
        <p>Thank you for being part of our community!</p>
        <p class="unsubscribe">
            <a href="{{unsubscribe_url}}">Unsubscribe</a> from these emails
        </p>
    </div>
</body>
</html>',
'Hello {{name}}!

{{message_body}}

{{#if call_to_action_url}}
{{call_to_action_text}}: {{call_to_action_url}}
{{/if}}

---
Thank you for being part of our community!

Unsubscribe: {{unsubscribe_url}}',
'["name", "company_name", "message_body", "call_to_action_url", "call_to_action_text", "unsubscribe_url"]',
true);