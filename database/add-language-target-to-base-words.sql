-- Add language_target column to our_video_base_words table
ALTER TABLE our_videos_base_words 
ADD COLUMN IF NOT EXISTS language_target VARCHAR(10);

-- Update the language_target from our_videos table
UPDATE our_videos_base_words bw
SET language_target = v.language_target
FROM our_videos v
WHERE bw.video_id = v.video_id;

-- Create an index on language_target for better query performance
CREATE INDEX IF NOT EXISTS idx_base_words_language_target 
ON our_videos_base_words(language_target);

-- Verify the update
SELECT 
    language_target, 
    COUNT(DISTINCT video_id) as video_count,
    COUNT(*) as word_count
FROM our_videos_base_words
GROUP BY language_target
ORDER BY language_target;