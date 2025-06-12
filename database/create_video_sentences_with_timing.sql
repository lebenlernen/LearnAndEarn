-- Create table for storing sentences with timing information from YouTube transcripts
-- This table is used by the SpaCy YouTube API and transcript display

CREATE TABLE IF NOT EXISTS our_video_sentences_timing (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    sentence_text TEXT NOT NULL,
    sentence_order INTEGER NOT NULL,
    start_time DECIMAL(10,2),
    duration DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't duplicate sentences for the same video
    UNIQUE(video_id, sentence_order)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_sentences_timing_video_id 
ON our_video_sentences_timing(video_id);

CREATE INDEX IF NOT EXISTS idx_video_sentences_timing_order 
ON our_video_sentences_timing(sentence_order);

-- If the old table exists, we can migrate data if needed
-- This is commented out by default to avoid accidental data changes
/*
INSERT INTO our_video_sentences_timing (video_id, sentence_text, sentence_order)
SELECT video_id, sentence, sentence_index
FROM our_video_sentences
WHERE NOT EXISTS (
    SELECT 1 FROM our_video_sentences_timing t 
    WHERE t.video_id = our_video_sentences.video_id 
    AND t.sentence_order = our_video_sentences.sentence_index
);
*/