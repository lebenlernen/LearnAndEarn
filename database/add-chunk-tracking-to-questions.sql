-- Add chunk tracking columns to questions table
ALTER TABLE our_video_questions
ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
ADD COLUMN IF NOT EXISTS chunk_total INTEGER,
ADD COLUMN IF NOT EXISTS chunk_position INTEGER,
ADD COLUMN IF NOT EXISTS chunk_text_preview TEXT;

-- Add index for chunk-based queries
CREATE INDEX IF NOT EXISTS idx_video_questions_chunk 
ON our_video_questions(video_id, chunk_index);

-- Add column to track question similarity (for future duplicate detection)
ALTER TABLE our_video_questions
ADD COLUMN IF NOT EXISTS question_hash VARCHAR(64);

-- Create a function to generate question hash
CREATE OR REPLACE FUNCTION generate_question_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a simple hash from the question text (lowercase, no spaces)
    NEW.question_hash = MD5(LOWER(REGEXP_REPLACE(NEW.question, '\s+', '', 'g')));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate hash
DROP TRIGGER IF EXISTS question_hash_trigger ON our_video_questions;
CREATE TRIGGER question_hash_trigger
BEFORE INSERT OR UPDATE OF question ON our_video_questions
FOR EACH ROW
EXECUTE FUNCTION generate_question_hash();

-- Update existing questions with hash
UPDATE our_video_questions 
SET question_hash = MD5(LOWER(REGEXP_REPLACE(question, '\s+', '', 'g')))
WHERE question_hash IS NULL;