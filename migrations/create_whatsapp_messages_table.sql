-- Create whatsapp_messages table for storing message history
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  sender_name TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_remote_jid ON whatsapp_messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);
