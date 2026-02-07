-- Add grace period and assignment blocking fields to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS blocked_from_assignments BOOLEAN DEFAULT FALSE;

-- Create notification log table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  crew_member_id UUID REFERENCES crew_members(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  recipient_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_log_document ON notification_log(document_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_crew ON notification_log(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);

-- Create document policies table for configuration
CREATE TABLE IF NOT EXISTS document_policies (
  document_type VARCHAR(50) PRIMARY KEY,
  warning_days INTEGER DEFAULT 30,
  grace_period_days INTEGER DEFAULT 7,
  blocks_assignments BOOLEAN DEFAULT TRUE,
  is_mandatory BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default policies for standard document types
INSERT INTO document_policies (document_type, blocks_assignments, is_mandatory) 
VALUES
  ('passport', TRUE, TRUE),
  ('cdc', TRUE, TRUE),
  ('coc', TRUE, FALSE),
  ('medical', TRUE, TRUE)
ON CONFLICT (document_type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE notification_log IS 'Tracks all document expiry notifications sent to crew members';
COMMENT ON TABLE document_policies IS 'Configuration for document types including grace periods and assignment blocking rules';
