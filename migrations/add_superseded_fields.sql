-- Migration: Add superseded fields to scanned_documents table
-- This allows tracking when document scans are replaced during renewal

ALTER TABLE scanned_documents 
ADD COLUMN superseded_at TIMESTAMP NULL,
ADD COLUMN superseded_by VARCHAR NULL;

-- Add comment for documentation
COMMENT ON COLUMN scanned_documents.superseded_at IS 'Timestamp when this scan was replaced by a newer version';
COMMENT ON COLUMN scanned_documents.superseded_by IS 'ID of the scan that replaced this one';

-- Create index for faster queries on active scans
CREATE INDEX idx_scanned_documents_superseded ON scanned_documents(superseded_at) 
WHERE superseded_at IS NULL;
