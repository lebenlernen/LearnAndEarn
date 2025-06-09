-- Create roles table
CREATE TABLE IF NOT EXISTS our_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO our_roles (name, description) VALUES 
    ('student', 'Can access learning materials and track progress'),
    ('teacher', 'Can create and manage learning content'),
    ('admin', 'Full system access and user management')
ON CONFLICT (name) DO NOTHING;

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS our_user_roles (
    user_id INTEGER NOT NULL REFERENCES our_users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES our_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES our_users(id),
    PRIMARY KEY (user_id, role_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON our_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON our_user_roles(role_id);

-- Migrate existing users to new role system
-- First, get the role IDs
DO $$
DECLARE
    student_role_id INTEGER;
    teacher_role_id INTEGER;
    admin_role_id INTEGER;
BEGIN
    SELECT id INTO student_role_id FROM our_roles WHERE name = 'student';
    SELECT id INTO teacher_role_id FROM our_roles WHERE name = 'teacher';
    SELECT id INTO admin_role_id FROM our_roles WHERE name = 'admin';
    
    -- Migrate existing users based on their current role
    INSERT INTO our_user_roles (user_id, role_id)
    SELECT id, 
        CASE role
            WHEN 'student' THEN student_role_id
            WHEN 'teacher' THEN teacher_role_id
            WHEN 'admin' THEN admin_role_id
            ELSE student_role_id -- Default to student
        END
    FROM our_users
    WHERE NOT EXISTS (
        SELECT 1 FROM our_user_roles WHERE user_id = our_users.id
    );
END $$;

-- Drop the old role column (optional - you might want to keep it for backup)
-- ALTER TABLE our_users DROP COLUMN IF EXISTS role;

-- Create a view for easy role checking
CREATE OR REPLACE VIEW our_user_roles_view AS
SELECT 
    u.id as user_id,
    u.email,
    u.username,
    array_agg(r.name ORDER BY r.name) as roles
FROM our_users u
LEFT JOIN our_user_roles ur ON u.id = ur.user_id
LEFT JOIN our_roles r ON ur.role_id = r.id
GROUP BY u.id, u.email, u.username; 