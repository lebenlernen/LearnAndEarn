-- Create a normalized table for individual word-video mappings
CREATE TABLE IF NOT EXISTS our_word_video_mapping (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    video_internal_id INTEGER,
    word VARCHAR(255) NOT NULL,
    word_position INTEGER DEFAULT 0,
    source_record_id INTEGER, -- Reference to original our_word_list.id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_id ON our_word_video_mapping(video_id);
CREATE INDEX IF NOT EXISTS idx_word ON our_word_video_mapping(word);
CREATE INDEX IF NOT EXISTS idx_video_word ON our_word_video_mapping(video_id, word);

-- Populate the new table by splitting the comma-separated words from our_word_list
INSERT INTO our_word_video_mapping (video_id, video_internal_id, word, word_position, source_record_id)
SELECT 
    wl.video_id,
    v.id as video_internal_id,
    TRIM(word_item.word) as word,
    word_item.position,
    wl.id as source_record_id
FROM our_word_list wl
JOIN our_videos v ON v.video_id = wl.video_id
CROSS JOIN LATERAL (
    SELECT 
        TRIM(unnest(string_to_array(wl.words, ','))) as word,
        row_number() OVER () as position
) as word_item
WHERE wl.words IS NOT NULL 
  AND wl.words != ''
  AND LENGTH(TRIM(word_item.word)) > 0; -- Skip empty words

-- Add a view to easily get words with their translations
CREATE OR REPLACE VIEW v_video_words_with_translations AS
SELECT 
    wvm.id,
    wvm.video_id,
    wvm.video_internal_id,
    wvm.word,
    wvm.word_position,
    vl.word_in_english,
    vl.word_in_vietnamese,
    vl.word_in_arabic,
    vl.base_form_of_german_word,
    v.title as video_title,
    v._type as video_category
FROM our_word_video_mapping wvm
LEFT JOIN our_vocabulary_list vl 
    ON (wvm.word = vl.word_in_german OR wvm.word = vl.base_form_of_german_word)
LEFT JOIN our_videos v 
    ON v.id = wvm.video_internal_id
ORDER BY wvm.video_internal_id, wvm.word_position;

-- Example query to see the results for a specific video
-- SELECT * FROM v_video_words_with_translations WHERE video_internal_id = 10058; 