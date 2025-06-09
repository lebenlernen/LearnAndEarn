-- Create table for spaced repetition learning
CREATE TABLE IF NOT EXISTS our_vocabulary_practice (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    video_id VARCHAR(255) NOT NULL,
    word VARCHAR(255) NOT NULL,
    lemma VARCHAR(255) NOT NULL,
    last_reviewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_review TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_count INTEGER DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,  -- Used in SM-2 algorithm
    interval_days INTEGER DEFAULT 1,
    difficulty_rating INTEGER, -- 1=easy, 2=good, 3=hard, 4=again
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_vocab
        FOREIGN KEY(user_id) 
        REFERENCES our_users(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT unique_user_word_video
        UNIQUE(user_id, video_id, word)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vocab_practice_user ON our_vocabulary_practice(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_practice_next_review ON our_vocabulary_practice(next_review);
CREATE INDEX IF NOT EXISTS idx_vocab_practice_video ON our_vocabulary_practice(video_id);

-- View for words due for review
CREATE OR REPLACE VIEW v_vocabulary_due_review AS
SELECT 
    vp.*,
    u.username,
    CASE 
        WHEN next_review <= CURRENT_TIMESTAMP THEN 'due'
        WHEN next_review <= CURRENT_TIMESTAMP + INTERVAL '1 day' THEN 'soon'
        ELSE 'scheduled'
    END as review_status
FROM our_vocabulary_practice vp
JOIN our_users u ON vp.user_id = u.id
WHERE vp.next_review <= CURRENT_TIMESTAMP + INTERVAL '7 days'
ORDER BY vp.next_review;