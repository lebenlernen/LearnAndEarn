-- Phase 2: Normalized vocabulary tables for advanced features
-- Run this after Phase 1 is working well

-- 1. Master lemma table (shared across all videos)
CREATE TABLE IF NOT EXISTS our_lemmas (
    id SERIAL PRIMARY KEY,
    lemma VARCHAR(255) UNIQUE NOT NULL,
    pos VARCHAR(50),
    is_common BOOLEAN DEFAULT FALSE,
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    vector_norm FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Video-specific vocabulary occurrences
CREATE TABLE IF NOT EXISTS our_video_vocabulary (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    lemma_id INTEGER NOT NULL REFERENCES our_lemmas(id),
    original_form VARCHAR(255) NOT NULL,
    tag VARCHAR(50),
    frequency INTEGER DEFAULT 1,
    first_occurrence_time FLOAT, -- seconds into video
    context_sentence TEXT,
    UNIQUE(video_id, original_form),
    FOREIGN KEY (video_id) REFERENCES our_videos(video_id) ON DELETE CASCADE
);

-- 3. User vocabulary progress (optional)
CREATE TABLE IF NOT EXISTS our_user_vocabulary_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lemma_id INTEGER NOT NULL REFERENCES our_lemmas(id),
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    times_seen INTEGER DEFAULT 1,
    times_practiced INTEGER DEFAULT 0,
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
    UNIQUE(user_id, lemma_id)
);

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_video_vocab_video ON our_video_vocabulary(video_id);
CREATE INDEX IF NOT EXISTS idx_video_vocab_lemma ON our_video_vocabulary(lemma_id);
CREATE INDEX IF NOT EXISTS idx_lemmas_pos ON our_lemmas(pos);
CREATE INDEX IF NOT EXISTS idx_lemmas_difficulty ON our_lemmas(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_user_vocab_user ON our_user_vocabulary_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocab_mastery ON our_user_vocabulary_progress(mastery_level);

-- 5. Useful views

-- View: Vocabulary by video with lemma details
CREATE OR REPLACE VIEW v_video_vocabulary_full AS
SELECT 
    vv.video_id,
    v.title as video_title,
    vv.original_form,
    l.lemma,
    l.pos,
    l.difficulty_level,
    vv.frequency,
    vv.tag
FROM our_video_vocabulary vv
JOIN our_lemmas l ON vv.lemma_id = l.id
JOIN our_videos v ON vv.video_id = v.video_id;

-- View: Video vocabulary statistics
CREATE OR REPLACE VIEW v_video_vocabulary_stats AS
SELECT 
    v.video_id,
    v.title,
    COUNT(DISTINCT vv.lemma_id) as unique_lemmas,
    SUM(vv.frequency) as total_words,
    AVG(l.difficulty_level) as avg_difficulty
FROM our_videos v
LEFT JOIN our_video_vocabulary vv ON v.video_id = vv.video_id
LEFT JOIN our_lemmas l ON vv.lemma_id = l.id
GROUP BY v.video_id, v.title; 