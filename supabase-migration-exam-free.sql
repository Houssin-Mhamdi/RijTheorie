-- Add is_free column to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- Update existing exams to not free
UPDATE exams SET is_free = false WHERE is_free IS NULL;
