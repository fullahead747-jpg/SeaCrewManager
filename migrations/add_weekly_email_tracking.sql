-- Add weekly summary email tracking fields to email_settings table
-- Migration: Add weekly email tracking

ALTER TABLE email_settings 
ADD COLUMN IF NOT EXISTS last_weekly_summary_month TEXT,
ADD COLUMN IF NOT EXISTS last_weekly_summary_sent TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN email_settings.last_weekly_summary_month IS 'YYYY-MM-WW format of last week summary was sent';
COMMENT ON COLUMN email_settings.last_weekly_summary_sent IS 'Timestamp when last weekly summary email was sent';
