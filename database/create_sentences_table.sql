-- Create table for storing sentences extracted from video subtitles
-- These sentences will be used for cloze tests and other exercises

CREATE TABLE IF NOT EXISTS our_video_sentences (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    sentence TEXT NOT NULL,
    sentence_index INTEGER,  -- Order in the video
    word_count INTEGER,
    has_entities BOOLEAN DEFAULT FALSE,
    difficulty_level INTEGER DEFAULT 2, -- 1=easy, 2=medium, 3=hard
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to our_videos
    CONSTRAINT fk_video_sentence 
        FOREIGN KEY(video_id) 
        REFERENCES our_videos(video_id) 
        ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sentences_video_id ON our_video_sentences(video_id);
CREATE INDEX IF NOT EXISTS idx_sentences_word_count ON our_video_sentences(word_count);
CREATE INDEX IF NOT EXISTS idx_sentences_difficulty ON our_video_sentences(difficulty_level);

-- Create table for cloze test attempts
CREATE TABLE IF NOT EXISTS our_cloze_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    cloze_word VARCHAR(255) NOT NULL,
    user_answer VARCHAR(255),
    is_correct BOOLEAN DEFAULT FALSE,
    time_taken_seconds INTEGER,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_cloze
        FOREIGN KEY(user_id) 
        REFERENCES our_users(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_sentence_cloze
        FOREIGN KEY(sentence_id) 
        REFERENCES our_video_sentences(id) 
        ON DELETE CASCADE
);

-- Create indexes for cloze attempts
CREATE INDEX IF NOT EXISTS idx_cloze_user_id ON our_cloze_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_cloze_sentence_id ON our_cloze_attempts(sentence_id);
CREATE INDEX IF NOT EXISTS idx_cloze_attempted_at ON our_cloze_attempts(attempted_at);

-- View for cloze test performance
CREATE OR REPLACE VIEW v_cloze_performance AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT ca.sentence_id) as sentences_attempted,
    COUNT(CASE WHEN ca.is_correct THEN 1 END) as correct_answers,
    ROUND(AVG(CASE WHEN ca.is_correct THEN 100 ELSE 0 END), 2) as accuracy_percentage,
    AVG(ca.time_taken_seconds) as avg_time_seconds
FROM our_users u
LEFT JOIN our_cloze_attempts ca ON u.id = ca.user_id
GROUP BY u.id, u.username;

-- Example queries:
-- 1. Get sentences for cloze tests (medium length)
-- SELECT * FROM our_video_sentences 
-- WHERE video_id = 'ABC123' 
-- AND word_count BETWEEN 7 AND 20
-- ORDER BY sentence_index;

-- 2. Track user performance
-- SELECT * FROM v_cloze_performance 
-- WHERE user_id = 1;