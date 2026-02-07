-- Add updatedAt column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update existing rows to have updatedAt same as createdAt
UPDATE documents 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Create index for better query performance on updatedAt
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
