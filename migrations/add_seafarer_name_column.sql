-- Migration: Add seafarer_name column to scanned_documents table
-- Purpose: Store crew member's full name from UI for validation and display
-- Date: 2026-01-03

-- Add the seafarer_name column
ALTER TABLE scanned_documents 
ADD COLUMN IF NOT EXISTS seafarer_name TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN scanned_documents.seafarer_name IS 'Crew member full name from UI (synced with Seafarer Name field) - used for validation';

-- Optional: Backfill existing records with crew member names
-- This will populate the seafarer_name for existing scanned documents
UPDATE scanned_documents sd
SET seafarer_name = CONCAT(cm.first_name, ' ', cm.last_name)
FROM documents d
JOIN crew_members cm ON d.crew_member_id = cm.id
WHERE sd.document_id = d.id
AND sd.seafarer_name IS NULL;
