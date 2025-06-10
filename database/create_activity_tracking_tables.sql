-- Activity Tracking Tables for LearnAndEarn
-- Track detailed user activity and learning time

-- User activity sessions
CREATE TABLE IF NOT EXISTS our_activity_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP,
    total_duration_seconds INTEGER DEFAULT 0,
    active_duration_seconds INTEGER DEFAULT 0,
    idle_duration_seconds INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    learning_activities INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_activity_sessions_user_id ON our_activity_sessions(user_id);
CREATE INDEX idx_activity_sessions_start ON our_activity_sessions(session_start);

-- Detailed activity log
CREATE TABLE IF NOT EXISTS our_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES our_activity_sessions(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'page_view', 'practice', 'video_watch', etc.
    activity_detail JSONB DEFAULT '{}',
    duration_seconds INTEGER DEFAULT 0,
    page_url VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for activity log
CREATE INDEX idx_activity_log_user_id ON our_activity_log(user_id);
CREATE INDEX idx_activity_log_session_id ON our_activity_log(session_id);
CREATE INDEX idx_activity_log_type ON our_activity_log(activity_type);
CREATE INDEX idx_activity_log_timestamp ON our_activity_log(timestamp);

-- Learning time summary table (updated via triggers)
CREATE TABLE IF NOT EXISTS our_learning_time_summary (
    user_id INTEGER PRIMARY KEY REFERENCES our_users(id) ON DELETE CASCADE,
    total_platform_time_seconds INTEGER DEFAULT 0,
    total_learning_time_seconds INTEGER DEFAULT 0,
    total_idle_time_seconds INTEGER DEFAULT 0,
    vocabulary_practice_time INTEGER DEFAULT 0,
    sentence_practice_time INTEGER DEFAULT 0,
    word_selection_time INTEGER DEFAULT 0,
    cloze_test_time INTEGER DEFAULT 0,
    video_watching_time INTEGER DEFAULT 0,
    summary_reading_time INTEGER DEFAULT 0,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily activity summary for reporting
CREATE TABLE IF NOT EXISTS our_daily_activity_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    active_time_seconds INTEGER DEFAULT 0,
    learning_time_seconds INTEGER DEFAULT 0,
    vocabulary_practices INTEGER DEFAULT 0,
    sentence_practices INTEGER DEFAULT 0,
    videos_watched INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date)
);

-- Create index for daily summaries
CREATE INDEX idx_daily_activity_user_date ON our_daily_activity_summary(user_id, activity_date);

-- Function to update learning time summary
CREATE OR REPLACE FUNCTION update_learning_time_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update the summary based on activity type
    INSERT INTO our_learning_time_summary (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update specific time counters based on activity type
    UPDATE our_learning_time_summary
    SET 
        total_platform_time_seconds = total_platform_time_seconds + NEW.duration_seconds,
        total_learning_time_seconds = CASE 
            WHEN NEW.activity_type IN ('vocabulary_practice', 'sentence_practice', 'word_selection', 
                                       'cloze_test', 'video_watch', 'dictation')
            THEN total_learning_time_seconds + NEW.duration_seconds
            ELSE total_learning_time_seconds
        END,
        vocabulary_practice_time = CASE 
            WHEN NEW.activity_type = 'vocabulary_practice' 
            THEN vocabulary_practice_time + NEW.duration_seconds 
            ELSE vocabulary_practice_time 
        END,
        sentence_practice_time = CASE 
            WHEN NEW.activity_type = 'sentence_practice' 
            THEN sentence_practice_time + NEW.duration_seconds 
            ELSE sentence_practice_time 
        END,
        word_selection_time = CASE 
            WHEN NEW.activity_type = 'word_selection' 
            THEN word_selection_time + NEW.duration_seconds 
            ELSE word_selection_time 
        END,
        cloze_test_time = CASE 
            WHEN NEW.activity_type = 'cloze_test' 
            THEN cloze_test_time + NEW.duration_seconds 
            ELSE cloze_test_time 
        END,
        video_watching_time = CASE 
            WHEN NEW.activity_type = 'video_watch' 
            THEN video_watching_time + NEW.duration_seconds 
            ELSE video_watching_time 
        END,
        summary_reading_time = CASE 
            WHEN NEW.activity_type = 'summary_read' 
            THEN summary_reading_time + NEW.duration_seconds 
            ELSE summary_reading_time 
        END,
        last_active = NEW.timestamp,
        last_updated = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic summary updates
DROP TRIGGER IF EXISTS update_learning_time_summary_trigger ON our_activity_log;
CREATE TRIGGER update_learning_time_summary_trigger
AFTER INSERT ON our_activity_log
FOR EACH ROW
EXECUTE FUNCTION update_learning_time_summary();

-- Function to close expired sessions
CREATE OR REPLACE FUNCTION close_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE our_activity_sessions
    SET 
        session_end = CURRENT_TIMESTAMP,
        total_duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - session_start))::INTEGER
    WHERE session_end IS NULL 
    AND session_start < CURRENT_TIMESTAMP - INTERVAL '4 hours';
END;
$$ LANGUAGE plpgsql;

-- View for teacher dashboard
CREATE OR REPLACE VIEW teacher_student_activity AS
SELECT 
    u.id as user_id,
    u.username,
    u.mother_language,
    ls.total_learning_time_seconds,
    ls.total_platform_time_seconds,
    ls.vocabulary_practice_time,
    ls.sentence_practice_time,
    ls.video_watching_time,
    ls.last_active,
    CASE 
        WHEN ls.last_active > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'Active'
        WHEN ls.last_active > CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 'Today'
        WHEN ls.last_active > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'This Week'
        ELSE 'Inactive'
    END as activity_status
FROM our_users u
LEFT JOIN our_learning_time_summary ls ON u.id = ls.user_id
WHERE u.role = 'student';

-- View for admin platform analytics
CREATE OR REPLACE VIEW admin_platform_analytics AS
SELECT 
    COUNT(DISTINCT user_id) as total_users,
    COUNT(DISTINCT CASE WHEN last_active > CURRENT_TIMESTAMP - INTERVAL '1 day' THEN user_id END) as daily_active_users,
    COUNT(DISTINCT CASE WHEN last_active > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN user_id END) as weekly_active_users,
    SUM(total_learning_time_seconds) as total_learning_time,
    SUM(total_platform_time_seconds) as total_platform_time,
    AVG(total_learning_time_seconds) as avg_learning_time_per_user,
    SUM(vocabulary_practice_time) as total_vocabulary_time,
    SUM(sentence_practice_time) as total_sentence_time,
    SUM(video_watching_time) as total_video_time
FROM our_learning_time_summary;