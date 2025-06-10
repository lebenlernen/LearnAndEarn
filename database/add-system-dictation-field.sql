-- Add use_system_dictation field to our_users table
ALTER TABLE our_users 
ADD COLUMN IF NOT EXISTS use_system_dictation BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN our_users.use_system_dictation IS 'User preference to use system dictation instead of built-in speech recognition';