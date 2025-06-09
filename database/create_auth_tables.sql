-- Create users table
CREATE TABLE IF NOT EXISTS our_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for express-session
CREATE TABLE IF NOT EXISTS our_sessions (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE our_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON our_sessions (expire);

-- Create user learning progress table
CREATE TABLE IF NOT EXISTS our_user_learning_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES our_users(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES our_videos(id),
    sentence_id VARCHAR(255), -- could be sentence hash or index
    practice_count INTEGER DEFAULT 0,
    last_accuracy FLOAT,
    best_accuracy FLOAT,
    last_practiced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id, sentence_id)
);

-- Create indexes for better performance
CREATE INDEX idx_our_users_email ON our_users(email);
CREATE INDEX idx_our_users_username ON our_users(username);
CREATE INDEX idx_our_user_learning_progress_user_id ON our_user_learning_progress(user_id);
CREATE INDEX idx_our_user_learning_progress_video_id ON our_user_learning_progress(video_id);

-- Insert a default admin user (password: admin123) - CHANGE THIS IN PRODUCTION!
-- Password hash is for 'admin123' - you should change this immediately after first login
INSERT INTO our_users (email, username, password_hash, role) 
VALUES ('admin@learnandearn.com', 'admin', '$2b$10$YourHashHere', 'admin')
ON CONFLICT (email) DO NOTHING; 