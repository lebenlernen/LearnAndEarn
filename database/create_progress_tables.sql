-- Drop existing table if we need to recreate with new structure
DROP TABLE IF EXISTS our_user_learning_progress;

-- Create detailed practice sessions table
CREATE TABLE IF NOT EXISTS our_practice_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES our_videos(id),
    sentence_text TEXT NOT NULL,
    sentence_index INTEGER, -- Position in the summary
    user_speech TEXT, -- What the user actually said
    expected_text TEXT, -- What was expected (full sentence or selection)
    accuracy_score FLOAT, -- Percentage of correct words in position
    correct_words INTEGER, -- Number of words in correct position
    total_words INTEGER, -- Total words in expected text
    practice_duration INTEGER, -- Duration in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create aggregated progress table for quick statistics
CREATE TABLE IF NOT EXISTS our_user_video_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES our_videos(id),
    total_practices INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    best_accuracy FLOAT DEFAULT 0,
    average_accuracy FLOAT DEFAULT 0,
    last_practiced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id)
);

-- Create problem sentences tracking
CREATE TABLE IF NOT EXISTS our_problem_sentences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES our_videos(id),
    sentence_text TEXT NOT NULL,
    practice_count INTEGER DEFAULT 1,
    best_accuracy FLOAT DEFAULT 0,
    average_accuracy FLOAT DEFAULT 0,
    common_mistakes TEXT[], -- Array of commonly confused words
    last_practiced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id, sentence_text)
);

-- Create indexes for better query performance
CREATE INDEX idx_practice_sessions_user_id ON our_practice_sessions(user_id);
CREATE INDEX idx_practice_sessions_video_id ON our_practice_sessions(video_id);
CREATE INDEX idx_practice_sessions_created_at ON our_practice_sessions(created_at);
CREATE INDEX idx_practice_sessions_accuracy ON our_practice_sessions(accuracy_score);

CREATE INDEX idx_user_video_progress_user_id ON our_user_video_progress(user_id);
CREATE INDEX idx_user_video_progress_video_id ON our_user_video_progress(video_id);

CREATE INDEX idx_problem_sentences_user_id ON our_problem_sentences(user_id);
CREATE INDEX idx_problem_sentences_accuracy ON our_problem_sentences(average_accuracy);

-- Function to update video progress after each practice session
CREATE OR REPLACE FUNCTION update_video_progress()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO our_user_video_progress (
        user_id, 
        video_id, 
        total_practices, 
        total_time_seconds,
        best_accuracy,
        average_accuracy,
        last_practiced_at
    )
    VALUES (
        NEW.user_id,
        NEW.video_id,
        1,
        COALESCE(NEW.practice_duration, 0),
        NEW.accuracy_score,
        NEW.accuracy_score,
        NEW.created_at
    )
    ON CONFLICT (user_id, video_id) 
    DO UPDATE SET
        total_practices = our_user_video_progress.total_practices + 1,
        total_time_seconds = our_user_video_progress.total_time_seconds + COALESCE(NEW.practice_duration, 0),
        best_accuracy = GREATEST(our_user_video_progress.best_accuracy, NEW.accuracy_score),
        average_accuracy = (
            (our_user_video_progress.average_accuracy * our_user_video_progress.total_practices + NEW.accuracy_score) 
            / (our_user_video_progress.total_practices + 1)
        ),
        last_practiced_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic progress updates
CREATE TRIGGER update_progress_after_practice
AFTER INSERT ON our_practice_sessions
FOR EACH ROW
EXECUTE FUNCTION update_video_progress(); 