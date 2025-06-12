-- Add last_heartbeat column to our_activity_sessions table
ALTER TABLE our_activity_sessions 
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP;