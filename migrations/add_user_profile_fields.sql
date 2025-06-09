-- Add profile fields to our_users table
ALTER TABLE our_users 
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS mother_language VARCHAR(100),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Europe/Berlin'; 