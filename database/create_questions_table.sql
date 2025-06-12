-- Create table for AI-generated questions
CREATE TABLE IF NOT EXISTS our_video_questions (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(50) NOT NULL REFERENCES our_videos(video_id),
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of {label, text} objects
    correct_answer VARCHAR(10) NOT NULL, -- A, B, C, or D
    question_type VARCHAR(50), -- comprehension, vocabulary, grammar, etc.
    difficulty VARCHAR(20), -- easy, medium, hard
    explanation TEXT, -- Optional explanation for the answer
    question_index INTEGER NOT NULL, -- Order within the video
    ai_model VARCHAR(100), -- Which AI model generated this
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_id, question_index)
);

-- Index for quick lookups
CREATE INDEX idx_video_questions_video_id ON our_video_questions(video_id);
CREATE INDEX idx_video_questions_type ON our_video_questions(question_type);
CREATE INDEX idx_video_questions_difficulty ON our_video_questions(difficulty);

-- Create table for AI-generated summaries and content
CREATE TABLE IF NOT EXISTS our_video_ai_content (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(50) NOT NULL REFERENCES our_videos(video_id) UNIQUE,
    ai_summary TEXT, -- AI-generated summary
    ai_content TEXT, -- AI-improved content for learning (if needed)
    ai_model VARCHAR(100), -- Which AI model was used
    processing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX idx_video_ai_content_video_id ON our_video_ai_content(video_id);

-- Sample insert for testing
/*
INSERT INTO our_video_questions (video_id, question, options, correct_answer, question_type, difficulty, question_index)
VALUES (
    'test_video_123',
    'Was ist das?',
    '[
        {"label": "A", "text": "Ein Tätowierer"},
        {"label": "B", "text": "Ein Mann mit vielen Körpermodifikationen"},
        {"label": "C", "text": "Ein Arzt"},
        {"label": "D", "text": "Ein Fernsehmoderator"}
    ]'::jsonb,
    'B',
    'comprehension',
    'easy',
    0
);
*/