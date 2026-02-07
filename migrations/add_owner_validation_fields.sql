-- Add owner validation fields to scanned_documents table
-- Migration: Add document owner validation tracking

ALTER TABLE scanned_documents 
ADD COLUMN IF NOT EXISTS owner_validation_status TEXT,
ADD COLUMN IF NOT EXISTS owner_validation_score INTEGER,
ADD COLUMN IF NOT EXISTS owner_validation_message TEXT;

-- Add comments for documentation
COMMENT ON COLUMN scanned_documents.owner_validation_status IS 'Validation status: match, warning, mismatch, or null';
COMMENT ON COLUMN scanned_documents.owner_validation_score IS 'Name similarity score from 0-100';
COMMENT ON COLUMN scanned_documents.owner_validation_message IS 'User-friendly validation message';
