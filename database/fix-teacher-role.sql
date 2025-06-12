-- Create teacher role if it doesn't exist
INSERT INTO our_roles (name, description) 
VALUES ('teacher', 'Lehrer-Rolle für Unterrichtsverwaltung')
ON CONFLICT (name) DO NOTHING;

-- Get the teacher role ID
DO $$
DECLARE
    teacher_role_id INTEGER;
    teacher_user_id INTEGER;
BEGIN
    -- Get teacher role ID
    SELECT id INTO teacher_role_id FROM our_roles WHERE name = 'teacher';
    
    -- Get demo teacher user ID
    SELECT id INTO teacher_user_id FROM our_users WHERE email = 'teacher@demo.com';
    
    -- Remove any existing roles for the teacher
    DELETE FROM our_user_roles WHERE user_id = teacher_user_id;
    
    -- Assign teacher role
    INSERT INTO our_user_roles (user_id, role_id) 
    VALUES (teacher_user_id, teacher_role_id);
    
    RAISE NOTICE 'Teacher role assigned to demo teacher';
END $$;