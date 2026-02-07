-- Migration: Add monthly calendar email tracking to email_settings table
-- This prevents duplicate emails on server restart by persisting tracking in the database

ALTER TABLE email_settings 
ADD COLUMN IF NOT EXISTS last_monthly_email_month TEXT,
ADD COLUMN IF NOT EXISTS last_monthly_email_morning_sent TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_monthly_email_evening_sent TIMESTAMP;

-- Add comment explaining the purpose
COMMENT ON COLUMN email_settings.last_monthly_email_month IS 'YYYY-MM format of last month when calendar email was sent';
COMMENT ON COLUMN email_settings.last_monthly_email_morning_sent IS 'Timestamp when morning (9 AM) calendar email was sent';
COMMENT ON COLUMN email_settings.last_monthly_email_evening_sent IS 'Timestamp when evening (6 PM) calendar email was sent';
