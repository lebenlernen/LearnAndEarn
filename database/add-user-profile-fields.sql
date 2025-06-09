-- Add user profile fields for country, mother language, and timezone
ALTER TABLE our_users 
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS mother_language VARCHAR(100),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Europe/Berlin';

-- Add index for country statistics
CREATE INDEX IF NOT EXISTS idx_users_country ON our_users(country);
CREATE INDEX IF NOT EXISTS idx_users_mother_language ON our_users(mother_language);

-- Update existing users with default values
UPDATE our_users 
SET timezone = 'Europe/Berlin' 
WHERE timezone IS NULL;

-- Show updated table structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'our_users' 
ORDER BY ordinal_position; 