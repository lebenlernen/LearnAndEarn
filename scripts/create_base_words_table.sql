-- Create table for storing SpaCy-processed base words (lemmas) for each video
-- This table stores the vocabulary analysis results from SpaCy

CREATE TABLE IF NOT EXISTS our_videos_base_words (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    original_word VARCHAR(255) NOT NULL,
    lemma VARCHAR(255) NOT NULL,
    pos VARCHAR(50),  -- Part of speech (NOUN, VERB, ADJ, etc.)
    tag VARCHAR(50),  -- Detailed grammatical tag
    is_stop_word BOOLEAN DEFAULT FALSE,
    has_vector BOOLEAN DEFAULT FALSE,
    vector_norm FLOAT,
    frequency INTEGER DEFAULT 1,  -- How often this word appears in the video
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to our_videos
    CONSTRAINT fk_video 
        FOREIGN KEY(video_id) 
        REFERENCES our_videos(video_id) 
        ON DELETE CASCADE,
    
    -- Ensure we don't duplicate the same word for a video
    CONSTRAINT unique_video_word 
        UNIQUE(video_id, original_word)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_base_words_video_id ON our_videos_base_words(video_id);
CREATE INDEX IF NOT EXISTS idx_base_words_lemma ON our_videos_base_words(lemma);
CREATE INDEX IF NOT EXISTS idx_base_words_pos ON our_videos_base_words(pos);
CREATE INDEX IF NOT EXISTS idx_base_words_frequency ON our_videos_base_words(frequency DESC);

-- Create a view for easy access to vocabulary statistics per video
CREATE OR REPLACE VIEW v_video_vocabulary_stats AS
SELECT 
    v.video_id,
    v.title,
    COUNT(DISTINCT bw.lemma) as unique_lemmas,
    COUNT(DISTINCT bw.original_word) as unique_words,
    SUM(bw.frequency) as total_word_count,
    COUNT(DISTINCT CASE WHEN bw.pos = 'NOUN' THEN bw.lemma END) as noun_count,
    COUNT(DISTINCT CASE WHEN bw.pos = 'VERB' THEN bw.lemma END) as verb_count,
    COUNT(DISTINCT CASE WHEN bw.pos = 'ADJ' THEN bw.lemma END) as adjective_count,
    COUNT(DISTINCT CASE WHEN bw.is_stop_word = false THEN bw.lemma END) as content_words
FROM our_videos v
LEFT JOIN our_videos_base_words bw ON v.video_id = bw.video_id
GROUP BY v.video_id, v.title;

-- Example queries:

-- 1. Get all base words for a specific video
-- SELECT * FROM our_videos_base_words 
-- WHERE video_id = 'iqkMO-0-2RA' 
-- ORDER BY frequency DESC, lemma;

-- 2. Find videos that contain a specific lemma
-- SELECT DISTINCT v.title, v.video_id, bw.frequency
-- FROM our_videos v
-- JOIN our_videos_base_words bw ON v.video_id = bw.video_id
-- WHERE bw.lemma = 'lernen'
-- ORDER BY bw.frequency DESC;

-- 3. Get most common lemmas across all videos
-- SELECT lemma, pos, COUNT(DISTINCT video_id) as video_count, SUM(frequency) as total_frequency
-- FROM our_videos_base_words
-- WHERE is_stop_word = false
-- GROUP BY lemma, pos
-- ORDER BY video_count DESC, total_frequency DESC
-- LIMIT 50;

-- 4. Find videos by difficulty (based on unique vocabulary)
-- SELECT * FROM v_video_vocabulary_stats
-- ORDER BY unique_lemmas DESC; 