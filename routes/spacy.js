const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const axios = require('axios');
const googleTranslate = require('../services/google-translate');

// SpaCy API base URL
const SPACY_API_URL = process.env.SPACY_API_URL || 'http://localhost:8001';

// Initialize google translate with database
router.use((req, res, next) => {
    googleTranslate.setDatabase(req.db);
    next();
});

// Get sentences for a video
router.get('/sentences/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.user.id;
        
        // Get user's mother language
        const userQuery = `
            SELECT mother_language 
            FROM our_users 
            WHERE id = $1
        `;
        const userResult = await req.db.query(userQuery, [userId]);
        const motherLanguage = userResult.rows[0]?.mother_language || 'English';
        const normalizedLanguage = googleTranslate.normalizeLanguage(motherLanguage);
        
        // Get YouTube video_id
        const videoQuery = `
            SELECT video_id, pure_subtitle 
            FROM our_videos 
            WHERE id = $1
        `;
        const videoResult = await req.db.query(videoQuery, [videoId]);
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Video not found'
            });
        }
        
        const youtubeVideoId = videoResult.rows[0].video_id;
        const subtitles = videoResult.rows[0].pure_subtitle;
        
        // Check if we already have sentences for this video
        const sentencesQuery = `
            SELECT s.*, t.translation 
            FROM our_video_sentences s
            LEFT JOIN our_sentence_translations t 
                ON s.id = t.sentence_id AND t.language = $2
            WHERE s.video_id = $1
            ORDER BY s.id
        `;
        let sentences = await req.db.query(sentencesQuery, [youtubeVideoId, normalizedLanguage]);
        
        if (sentences.rows.length === 0 && subtitles) {
            // Extract sentences from subtitles using SpaCy
            console.log('Extracting sentences for video:', youtubeVideoId);
            
            try {
                // Simple sentence extraction as fallback
                let sentencesArray = [];
                
                // Try SpaCy first
                try {
                    const response = await axios.post(
                        `${SPACY_API_URL}/extract_sentences`,
                        {
                            text: subtitles,
                            video_id: youtubeVideoId
                        }
                    );
                    
                    if (response.data && response.data.sentences) {
                        sentencesArray = response.data.sentences;
                    }
                } catch (spacyError) {
                    console.log('SpaCy not available, using simple extraction');
                    // Fallback: Simple sentence splitting
                    sentencesArray = subtitles
                        .split(/[.!?]+/)
                        .map(s => s.trim())
                        .filter(s => s.length > 10 && /[a-zA-ZäöüÄÖÜß]/.test(s))
                        .map(s => s.charAt(0).toUpperCase() + s.slice(1));
                }
                
                if (sentencesArray.length > 0) {
                    console.log(`Storing ${sentencesArray.length} sentences for video ${youtubeVideoId}`);
                    // Store sentences in database
                    for (let i = 0; i < sentencesArray.length; i++) {
                        const sentence = sentencesArray[i];
                        const wordCount = sentence.split(/\s+/).length;
                        
                        // First check if sentence already exists
                        const existingCheck = await req.db.query(
                            `SELECT id FROM our_video_sentences 
                             WHERE video_id = $1 AND sentence = $2`,
                            [youtubeVideoId, sentence]
                        );
                        
                        let sentenceId;
                        if (existingCheck.rows.length > 0) {
                            sentenceId = existingCheck.rows[0].id;
                        } else {
                            const insertResult = await req.db.query(
                                `INSERT INTO our_video_sentences 
                                 (video_id, sentence)
                                 VALUES ($1, $2)
                                 RETURNING id`,
                                [youtubeVideoId, sentence]
                            );
                            sentenceId = insertResult.rows[0].id;
                        }
                        
                        if (sentenceId && normalizedLanguage !== 'German') {
                            
                            // Translate sentence
                            try {
                                const translation = await googleTranslate.translateText(
                                    sentence, 
                                    normalizedLanguage, 
                                    'German'
                                );
                                
                                if (translation) {
                                    await req.db.query(
                                        `INSERT INTO our_sentence_translations 
                                         (sentence_id, language, translation)
                                         VALUES ($1, $2, $3)
                                         ON CONFLICT (sentence_id, language) DO NOTHING`,
                                        [sentenceId, normalizedLanguage, translation]
                                    );
                                }
                            } catch (err) {
                                console.error('Failed to translate sentence:', err);
                            }
                        }
                    }
                    
                    // Fetch the stored sentences with translations
                    sentences = await req.db.query(sentencesQuery, [youtubeVideoId, normalizedLanguage]);
                }
            } catch (err) {
                console.error('Failed to extract sentences:', err);
            }
        }
        
        res.json({
            success: true,
            data: {
                sentences: sentences.rows,
                count: sentences.rows.length,
                mother_language: normalizedLanguage
            }
        });
        
    } catch (error) {
        console.error('Error fetching sentences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentences',
            details: error.message
        });
    }
});


// Process video subtitles with SpaCy
router.post('/process-video', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.body;
        
        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: 'Video ID is required'
            });
        }
        
        // Call Python SpaCy API
        const response = await axios.post(`${SPACY_API_URL}/process_video`, {
            video_id: videoId
        });
        
        res.json({
            success: true,
            data: response.data
        });
        
    } catch (error) {
        console.error('Error processing video:', error);
        res.status(500).json({
            success: false,
            error: error.response?.data?.detail || 'Failed to process video'
        });
    }
});

// Get processed vocabulary for a video
router.get('/vocabulary/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.params; // This is the internal ID
        const { limit = 50 } = req.query;
        const userId = req.user.id;
        
        // Get user's mother language
        const userQuery = `
            SELECT mother_language 
            FROM our_users 
            WHERE id = $1
        `;
        const userResult = await req.db.query(userQuery, [userId]);
        const motherLanguage = userResult.rows[0]?.mother_language || 'English';
        const normalizedLanguage = googleTranslate.normalizeLanguage(motherLanguage);
        
        // First, get the YouTube video_id from our_videos table
        const videoQuery = `
            SELECT video_id 
            FROM our_videos 
            WHERE id = $1
        `;
        const videoResult = await req.db.query(videoQuery, [videoId]);
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Video not found'
            });
        }
        
        const youtubeVideoId = videoResult.rows[0].video_id;
        console.log('Getting vocabulary for YouTube video:', youtubeVideoId);
        
        // Check if video is processed
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM our_videos_base_words 
            WHERE video_id = $1
        `;
        const checkResult = await req.db.query(checkQuery, [youtubeVideoId]);
        
        if (checkResult.rows[0].count === '0') {
            console.log('Video not processed yet, processing now...');
            // Process the video first
            try {
                const processResponse = await axios.post(`${SPACY_API_URL}/process_video`, {
                    video_id: youtubeVideoId
                });
                console.log('Processing complete:', processResponse.data);
            } catch (processError) {
                console.error('Failed to process video:', processError.response?.data || processError.message);
            }
        }
        
        // Get vocabulary from Python API
        const response = await axios.get(
            `${SPACY_API_URL}/vocabulary/${youtubeVideoId}?limit=${limit}`
        );
        
        // Translate vocabulary words if mother language is not German
        let vocabData = response.data;
        if (motherLanguage !== 'German' && motherLanguage !== 'Deutsch' && vocabData.vocabulary) {
            try {
                console.log(`Translating ${vocabData.vocabulary.length} words to ${normalizedLanguage}`);
                console.log('First 5 words with lemmas:', vocabData.vocabulary.slice(0, 5).map(w => ({
                    word: w.original_word,
                    lemma: w.lemma,
                    pos: w.pos
                })));
                
                // Use the new method that checks lemma storage first
                vocabData.vocabulary = await googleTranslate.translateVocabularyWithLemmas(
                    vocabData.vocabulary, 
                    normalizedLanguage, 
                    'German'
                );
                
                console.log('First word with translation:', vocabData.vocabulary[0]);
            } catch (err) {
                console.error('Failed to translate vocabulary:', err);
            }
        }
        
        res.json({
            success: true,
            data: {
                ...vocabData,
                mother_language: normalizedLanguage
            }
        });
        
    } catch (error) {
        console.error('Error fetching vocabulary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vocabulary',
            details: error.message
        });
    }
});

// Generate cloze tests
router.get('/cloze-tests/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.params; // This is the internal ID
        const { count = 5 } = req.query;
        
        // First, get the YouTube video_id and summary
        const videoQuery = `
            SELECT v.video_id, v.title, 
                   COALESCE(vs.summary, v.pure_subtitle, '') as summary
            FROM our_videos v
            LEFT JOIN our_video_summary vs ON v.id = vs.video
            WHERE v.id = $1
        `;
        const videoResult = await req.db.query(videoQuery, [videoId]);
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Video not found'
            });
        }
        
        const youtubeVideoId = videoResult.rows[0].video_id;
        const summary = videoResult.rows[0].summary;
        console.log('Generating cloze tests for YouTube video:', youtubeVideoId);
        
        try {
            // Try SpaCy API first
            const response = await axios.get(
                `${SPACY_API_URL}/cloze_tests/${youtubeVideoId}?count=${count}`
            );
            
            res.json({
                success: true,
                data: response.data
            });
        } catch (spacyError) {
            console.log('SpaCy API not available, using fallback cloze test generation');
            
            // Fallback: Generate simple cloze tests from summary
            if (!summary) {
                return res.json({
                    success: true,
                    data: { cloze_tests: [], count: 0 }
                });
            }
            
            // Extract sentences
            const sentences = summary
                .split(/[.!?]+/)
                .map(s => s.trim())
                .filter(s => s.length > 20 && s.split(/\s+/).length > 4);
            
            // Generate cloze tests
            const clozeTests = [];
            const usedSentences = new Set();
            
            while (clozeTests.length < count && usedSentences.size < sentences.length) {
                const randomIndex = Math.floor(Math.random() * sentences.length);
                if (usedSentences.has(randomIndex)) continue;
                
                usedSentences.add(randomIndex);
                const sentence = sentences[randomIndex];
                const words = sentence.split(/\s+/);
                
                // Find content words (skip articles, prepositions, etc.)
                const contentWords = words.filter(word => {
                    const clean = word.toLowerCase().replace(/[.,!?;:"']/g, '');
                    return clean.length > 3 && 
                           !['der', 'die', 'das', 'und', 'oder', 'aber', 'weil', 'dass', 'mit', 'von', 'für', 'auf', 'bei', 'nach', 'vor', 'über', 'unter'].includes(clean);
                });
                
                if (contentWords.length > 0) {
                    const targetWord = contentWords[Math.floor(Math.random() * contentWords.length)];
                    const cleanTarget = targetWord.replace(/[.,!?;:"']/g, '');
                    const blankedSentence = sentence.replace(targetWord, '_____');
                    
                    clozeTests.push({
                        sentence_id: randomIndex,
                        sentence: blankedSentence,
                        cloze_word: cleanTarget,
                        pos: 'NOUN', // Default POS tag
                        lemma: cleanTarget.toLowerCase()
                    });
                }
            }
            
            res.json({
                success: true,
                data: {
                    cloze_tests: clozeTests,
                    count: clozeTests.length
                }
            });
        }
        
    } catch (error) {
        console.error('Error generating cloze tests:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate cloze tests'
        });
    }
});

// Save cloze test attempt
router.post('/cloze-attempt', isAuthenticated, async (req, res) => {
    try {
        const { sentenceId, clozeWord, userAnswer, timeTaken } = req.body;
        const userId = req.user.id;
        
        const isCorrect = clozeWord.toLowerCase() === userAnswer.toLowerCase();
        
        const query = `
            INSERT INTO our_cloze_attempts 
            (user_id, sentence_id, cloze_word, user_answer, is_correct, time_taken_seconds)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await req.db.query(query, [
            userId,
            sentenceId,
            clozeWord,
            userAnswer,
            isCorrect,
            timeTaken
        ]);
        
        res.json({
            success: true,
            attempt: result.rows[0],
            isCorrect
        });
        
    } catch (error) {
        console.error('Error saving cloze attempt:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save attempt'
        });
    }
});

// Get word context and examples
router.get('/word-context/:videoId/:word', isAuthenticated, async (req, res) => {
    try {
        const { videoId, word } = req.params; // videoId is the internal ID
        const userId = req.user.id;
        
        // Get user's mother language
        const userQuery = `
            SELECT mother_language 
            FROM our_users 
            WHERE id = $1
        `;
        const userResult = await req.db.query(userQuery, [userId]);
        const motherLanguage = userResult.rows[0]?.mother_language || 'English';
        
        // First, get the YouTube video_id
        const videoQuery = `
            SELECT video_id 
            FROM our_videos 
            WHERE id = $1
        `;
        const videoResult = await req.db.query(videoQuery, [videoId]);
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Video not found'
            });
        }
        
        const youtubeVideoId = videoResult.rows[0].video_id;
        
        const response = await axios.get(
            `${SPACY_API_URL}/word_context/${youtubeVideoId}/${encodeURIComponent(word)}`
        );
        
        // Add translation if mother language is not German
        let translation = null;
        const normalizedLanguage = googleTranslate.normalizeLanguage(motherLanguage);
        
        if (motherLanguage !== 'German' && motherLanguage !== 'Deutsch') {
            try {
                // Use Google Translate API
                translation = await googleTranslate.translateText(word, normalizedLanguage, 'German');
            } catch (err) {
                console.error('Translation failed:', err);
            }
        }
        
        res.json({
            success: true,
            data: {
                ...response.data,
                translation: translation,
                mother_language: normalizedLanguage
            }
        });
        
    } catch (error) {
        console.error('Error fetching word context:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch word context'
        });
    }
});

// Get similar words
router.get('/similar-words/:word', isAuthenticated, async (req, res) => {
    try {
        const { word } = req.params;
        const { limit = 10 } = req.query;
        
        const response = await axios.get(
            `${SPACY_API_URL}/similar_words/${encodeURIComponent(word)}?limit=${limit}`
        );
        
        res.json({
            success: true,
            data: response.data
        });
        
    } catch (error) {
        console.error('Error fetching similar words:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch similar words'
        });
    }
});

// Get user's cloze test performance
router.get('/cloze-performance', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const query = `
            SELECT 
                COUNT(DISTINCT sentence_id) as sentences_attempted,
                COUNT(CASE WHEN is_correct THEN 1 END) as correct_answers,
                COUNT(*) as total_attempts,
                ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 2) as accuracy_percentage,
                ROUND(AVG(time_taken_seconds), 1) as avg_time_seconds
            FROM our_cloze_attempts
            WHERE user_id = $1
        `;
        
        const result = await req.db.query(query, [userId]);
        
        res.json({
            success: true,
            performance: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching performance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch performance'
        });
    }
});

// Save vocabulary practice (spaced repetition)
router.post('/vocabulary-practice', isAuthenticated, async (req, res) => {
    try {
        const { videoId, word, lemma, difficulty } = req.body;
        const userId = req.user.id;
        
        // Calculate next review date using SM-2 algorithm
        const calculateNextReview = (easeFactor, intervalDays, difficulty) => {
            let newEaseFactor = easeFactor;
            let newInterval = intervalDays;
            
            // Adjust ease factor based on difficulty
            if (difficulty === 1) { // Easy
                newEaseFactor = Math.min(easeFactor + 0.15, 2.8);
                newInterval = Math.round(intervalDays * newEaseFactor * 1.3);
            } else if (difficulty === 2) { // Good
                newEaseFactor = Math.min(easeFactor + 0.1, 2.5);
                newInterval = Math.round(intervalDays * newEaseFactor);
            } else if (difficulty === 3) { // Hard
                newEaseFactor = Math.max(easeFactor - 0.15, 1.3);
                newInterval = Math.round(intervalDays * newEaseFactor * 0.6);
            } else if (difficulty === 4) { // Again
                newEaseFactor = Math.max(easeFactor - 0.2, 1.3);
                newInterval = 1; // Reset to 1 day
            }
            
            // Minimum interval is 1 day
            newInterval = Math.max(1, newInterval);
            
            return { easeFactor: newEaseFactor, intervalDays: newInterval };
        };
        
        // Check if practice record exists
        const checkQuery = `
            SELECT * FROM our_vocabulary_practice 
            WHERE user_id = $1 AND video_id = $2 AND word = $3
        `;
        const checkResult = await req.db.query(checkQuery, [userId, videoId, word]);
        
        let result;
        if (checkResult.rows.length > 0) {
            // Update existing record
            const existing = checkResult.rows[0];
            const { easeFactor, intervalDays } = calculateNextReview(
                existing.ease_factor,
                existing.interval_days,
                difficulty
            );
            
            const updateQuery = `
                UPDATE our_vocabulary_practice
                SET last_reviewed = CURRENT_TIMESTAMP,
                    next_review = CURRENT_TIMESTAMP + INTERVAL '1 day' * $1,
                    review_count = review_count + 1,
                    ease_factor = $2,
                    interval_days = $3,
                    difficulty_rating = $4
                WHERE user_id = $5 AND video_id = $6 AND word = $7
                RETURNING *
            `;
            
            result = await req.db.query(updateQuery, [
                intervalDays,
                easeFactor,
                intervalDays,
                difficulty,
                userId,
                videoId,
                word
            ]);
        } else {
            // Insert new record
            const { easeFactor, intervalDays } = calculateNextReview(2.5, 1, difficulty);
            
            const insertQuery = `
                INSERT INTO our_vocabulary_practice 
                (user_id, video_id, word, lemma, next_review, ease_factor, interval_days, difficulty_rating)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '1 day' * $5, $6, $7, $8)
                RETURNING *
            `;
            
            result = await req.db.query(insertQuery, [
                userId,
                videoId,
                word,
                lemma,
                intervalDays,
                easeFactor,
                intervalDays,
                difficulty
            ]);
        }
        
        res.json({
            success: true,
            ...result.rows[0]
        });
        
    } catch (error) {
        console.error('Error saving vocabulary practice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save practice'
        });
    }
});

// Get vocabulary statistics for a word
router.get('/vocabulary-stats/:videoId/:word', isAuthenticated, async (req, res) => {
    try {
        const { videoId, word } = req.params;
        const userId = req.user.id;
        
        const query = `
            SELECT * FROM our_vocabulary_practice
            WHERE user_id = $1 AND video_id = $2 AND word = $3
        `;
        
        const result = await req.db.query(query, [userId, videoId, word]);
        
        res.json({
            success: true,
            stats: result.rows[0] || null
        });
        
    } catch (error) {
        console.error('Error fetching vocabulary stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

// Get words due for review
router.get('/vocabulary-due', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20 } = req.query;
        
        const query = `
            SELECT vp.*, v.title as video_title
            FROM our_vocabulary_practice vp
            LEFT JOIN our_videos v ON vp.video_id = v.video_id
            WHERE vp.user_id = $1 
                AND vp.next_review <= CURRENT_TIMESTAMP
            ORDER BY vp.next_review ASC
            LIMIT $2
        `;
        
        const result = await req.db.query(query, [userId, limit]);
        
        res.json({
            success: true,
            words: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching due words:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch due words'
        });
    }
});

// Get sentences containing a specific word from all videos
router.get('/sentences-by-word/:word', isAuthenticated, async (req, res) => {
    try {
        const { word } = req.params;
        const { limit = 3 } = req.query;
        
        // Search for sentences containing this word across all videos
        const query = `
            SELECT s.sentence, v.title as video_title, v.video_id
            FROM our_video_sentences s
            JOIN our_videos v ON s.video_id = v.video_id
            WHERE LOWER(s.sentence) LIKE LOWER($1)
            GROUP BY s.sentence, v.title, v.video_id
            ORDER BY RANDOM()
            LIMIT $2
        `;
        
        const searchPattern = `%${word}%`;
        const result = await req.db.query(query, [searchPattern, limit]);
        
        res.json({
            success: true,
            sentences: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching sentences by word:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentences'
        });
    }
});

module.exports = router;