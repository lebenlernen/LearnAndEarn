-- Schools table
CREATE TABLE IF NOT EXISTS our_schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'Europe/Berlin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update users table for teacher role and school connection
ALTER TABLE our_users 
ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES our_schools(id),
ADD COLUMN IF NOT EXISTS is_teacher BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Europe/Berlin';

-- Classes (groups of students)
CREATE TABLE IF NOT EXISTS our_classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES our_schools(id),
    teacher_id INTEGER REFERENCES our_users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Class members
CREATE TABLE IF NOT EXISTS our_class_members (
    class_id INTEGER REFERENCES our_classes(id),
    student_id INTEGER REFERENCES our_users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, student_id)
);

-- Sessions/School hours
CREATE TABLE IF NOT EXISTS our_school_sessions (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES our_users(id),
    class_id INTEGER REFERENCES our_classes(id),
    title VARCHAR(255),
    description TEXT,
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
    session_type VARCHAR(50) DEFAULT 'class', -- class, invitation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session invitations (for non-class sessions)
CREATE TABLE IF NOT EXISTS our_session_invitations (
    session_id INTEGER REFERENCES our_school_sessions(id),
    student_id INTEGER REFERENCES our_users(id),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined
    PRIMARY KEY (session_id, student_id)
);

-- Active session participants
CREATE TABLE IF NOT EXISTS our_session_participants (
    session_id INTEGER REFERENCES our_school_sessions(id),
    user_id INTEGER REFERENCES our_users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (session_id, user_id)
);

-- Teacher navigation tracking (only for educational pages)
CREATE TABLE IF NOT EXISTS our_teacher_navigation (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES our_school_sessions(id),
    teacher_id INTEGER REFERENCES our_users(id),
    page_type VARCHAR(50), -- 'video', 'vocabulary', 'questions', 'cloze'
    page_url VARCHAR(500),
    page_data JSONB, -- stores video_id, exercise details etc
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_teacher_navigation_session ON our_teacher_navigation(session_id);
CREATE INDEX IF NOT EXISTS idx_teacher_navigation_timestamp ON our_teacher_navigation(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_participants_active ON our_session_participants(session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_school_sessions_status ON our_school_sessions(status);
CREATE INDEX IF NOT EXISTS idx_school_sessions_teacher ON our_school_sessions(teacher_id);