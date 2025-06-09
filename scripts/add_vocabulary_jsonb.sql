-- Add JSONB column for vocabulary data to our_videos table
-- This allows immediate use of SpaCy-processed vocabulary

-- 1. Add the column
ALTER TABLE our_videos 
ADD COLUMN IF NOT EXISTS vocabulary_data JSONB;

-- 2. Create index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_videos_vocabulary_data 
ON our_videos USING GIN (vocabulary_data);

-- 3. Example of how to update a video with vocabulary data
-- UPDATE our_videos 
-- SET vocabulary_data = '{
--   "processed_at": "2025-06-09T18:32:59",
--   "model_used": "de_core_news_lg",
--   "statistics": {
--     "total_words": 430,
--     "unique_lemmas": 366,
--     "pos_distribution": {
--       "VERB": 101,
--       "NOUN": 87,
--       "ADV": 85
--     }
--   },
--   "vocabulary": [
--     {
--       "original": "haben",
--       "lemma": "haben",
--       "pos": "AUX",
--       "frequency": 6,
--       "has_vector": true
--     }
--   ]
-- }'::jsonb
-- WHERE video_id = 'iqkMO-0-2RA';

-- 4. Useful queries:

-- Find videos with specific lemma
-- SELECT title, video_id 
-- FROM our_videos 
-- WHERE vocabulary_data @> '{"vocabulary": [{"lemma": "Konjunktiv"}]}';

-- Get vocabulary statistics
-- SELECT 
--   title,
--   vocabulary_data->'statistics'->>'total_words' as total_words,
--   vocabulary_data->'statistics'->>'unique_lemmas' as unique_lemmas
-- FROM our_videos 
-- WHERE vocabulary_data IS NOT NULL; 