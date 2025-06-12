-- Create table for AI-generated video summaries
CREATE TABLE IF NOT EXISTS our_video_ai_summaries (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) UNIQUE NOT NULL,
    short_summary TEXT, -- 100-200 words for search/preview
    long_summary_raw TEXT, -- Full AI-generated learning text
    ai_model VARCHAR(100), -- e.g., 'gpt-3.5-turbo', 'deepseek-chat'
    ai_prompt_version VARCHAR(50), -- Track prompt iterations
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT, -- Store any processing errors
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to our_videos
    CONSTRAINT fk_video_ai_summary 
        FOREIGN KEY(video_id) 
        REFERENCES our_videos(video_id) 
        ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_summaries_video_id ON our_video_ai_summaries(video_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_status ON our_video_ai_summaries(processing_status);

-- Add missing columns to video sentences table
ALTER TABLE our_video_sentences 
ADD COLUMN IF NOT EXISTS sentence_index INTEGER,
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'transcript',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index on source for faster filtering
CREATE INDEX IF NOT EXISTS idx_video_sentences_source ON our_video_sentences(source);
CREATE INDEX IF NOT EXISTS idx_video_sentences_active ON our_video_sentences(is_active);

-- Update existing sentences to have source = 'transcript'
UPDATE our_video_sentences 
SET source = 'transcript' 
WHERE source IS NULL;

-- View to get active learning sentences for a video
CREATE OR REPLACE VIEW v_active_learning_sentences AS
SELECT 
    vs.id,
    vs.video_id,
    vs.sentence,
    vs.sentence_index,
    vs.word_count,
    vs.source,
    v.title as video_title,
    v.language_target
FROM our_video_sentences vs
JOIN our_videos v ON vs.video_id = v.video_id
WHERE vs.is_active = true
ORDER BY vs.video_id, vs.sentence_index;