-- Fix timezone handling for timestamps
-- This script ensures all timestamp columns use TIMESTAMPTZ (timestamp with time zone)
-- which properly handles timezone conversions

-- Show current timezone setting
SHOW timezone;

-- Optionally set the database timezone to Europe/Berlin
-- ALTER DATABASE jetzt SET timezone TO 'Europe/Berlin';

-- Update existing timestamp columns to use TIMESTAMPTZ
-- This preserves existing data but ensures proper timezone handling

-- Update our_users table
ALTER TABLE our_users 
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Update our_practice_sessions table
ALTER TABLE our_practice_sessions 
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Update our_user_video_progress table
ALTER TABLE our_user_video_progress 
    ALTER COLUMN last_practiced_at TYPE TIMESTAMPTZ USING last_practiced_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Update our_problem_sentences table
ALTER TABLE our_problem_sentences 
    ALTER COLUMN last_practiced_at TYPE TIMESTAMPTZ USING last_practiced_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Update the trigger function to use CURRENT_TIMESTAMP (which respects timezone)
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

-- Display current timezone info for verification
SELECT current_setting('TIMEZONE') as database_timezone,
       NOW() as current_timestamp_with_tz,
       NOW()::timestamp as current_timestamp_without_tz; 