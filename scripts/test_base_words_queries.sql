-- Useful queries for our_videos_base_words table

-- 1. Get vocabulary for a specific video
SELECT 
    original_word,
    lemma,
    pos,
    frequency,
    is_stop_word
FROM our_videos_base_words
WHERE video_id = 'iqkMO-0-2RA'
ORDER BY frequency DESC, lemma
LIMIT 20;

-- 2. Find all videos that teach a specific word/lemma
SELECT DISTINCT
    v.title,
    v.video_id,
    bw.original_word,
    bw.frequency
FROM our_videos v
JOIN our_videos_base_words bw ON v.video_id = bw.video_id
WHERE bw.lemma = 'schreiben'
ORDER BY bw.frequency DESC;

-- 3. Get vocabulary statistics for all videos
SELECT * FROM v_video_vocabulary_stats
ORDER BY unique_lemmas DESC;

-- 4. Find the most common words across all videos
SELECT 
    lemma,
    pos,
    COUNT(DISTINCT video_id) as appears_in_videos,
    SUM(frequency) as total_occurrences,
    ROUND(AVG(vector_norm), 2) as avg_vector_norm
FROM our_videos_base_words
WHERE is_stop_word = false
GROUP BY lemma, pos
HAVING COUNT(DISTINCT video_id) >= 3
ORDER BY appears_in_videos DESC, total_occurrences DESC
LIMIT 20;

-- 5. Find videos by vocabulary difficulty (unique non-stop words)
SELECT 
    v.video_id,
    v.title,
    COUNT(DISTINCT CASE WHEN bw.is_stop_word = false THEN bw.lemma END) as content_words,
    COUNT(DISTINCT bw.lemma) as total_unique_words,
    ROUND(
        COUNT(DISTINCT CASE WHEN bw.is_stop_word = false THEN bw.lemma END)::numeric / 
        COUNT(DISTINCT bw.lemma)::numeric * 100, 
        1
    ) as content_word_percentage
FROM our_videos v
JOIN our_videos_base_words bw ON v.video_id = bw.video_id
GROUP BY v.video_id, v.title
ORDER BY content_words DESC;

-- 6. Get POS distribution for a video
SELECT 
    pos,
    COUNT(DISTINCT lemma) as unique_lemmas,
    SUM(frequency) as total_occurrences,
    ROUND(SUM(frequency)::numeric / (SELECT SUM(frequency) FROM our_videos_base_words WHERE video_id = 'iqkMO-0-2RA') * 100, 1) as percentage
FROM our_videos_base_words
WHERE video_id = 'iqkMO-0-2RA'
GROUP BY pos
ORDER BY total_occurrences DESC;

-- 7. Find videos that share vocabulary (for recommendations)
WITH target_video_words AS (
    SELECT DISTINCT lemma
    FROM our_videos_base_words
    WHERE video_id = 'iqkMO-0-2RA'
    AND is_stop_word = false
)
SELECT 
    v.video_id,
    v.title,
    COUNT(DISTINCT bw.lemma) as shared_words,
    COUNT(DISTINCT bw.lemma)::numeric / (SELECT COUNT(*) FROM target_video_words) * 100 as overlap_percentage
FROM our_videos v
JOIN our_videos_base_words bw ON v.video_id = bw.video_id
WHERE bw.lemma IN (SELECT lemma FROM target_video_words)
AND v.video_id != 'iqkMO-0-2RA'
GROUP BY v.video_id, v.title
HAVING COUNT(DISTINCT bw.lemma) > 5
ORDER BY shared_words DESC; 