const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// Get vocabulary for a specific video
router.get('/video/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.params;
        
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
        console.log('Looking for vocabulary for YouTube video:', youtubeVideoId);
        
        // Get words from our_word_list using the YouTube video_id
        const wordsQuery = `
            SELECT * 
            FROM our_word_list 
            WHERE video_id = $1
            ORDER BY number
            LIMIT 50
        `;
        
        const wordsResult = await req.db.query(wordsQuery, [youtubeVideoId]);
        
        // For each word, try to find translations in our_vocabulary_list
        const wordsWithTranslations = await Promise.all(
            wordsResult.rows.map(async (wordRow) => {
                // Parse the words JSON if it exists
                let germanWords = [];
                try {
                    if (wordRow.words) {
                        germanWords = JSON.parse(wordRow.words);
                    }
                } catch (e) {
                    // If not JSON, treat as single word
                    germanWords = [wordRow.words];
                }
                
                // Get translations for each German word
                const translations = await Promise.all(
                    germanWords.map(async (germanWord) => {
                        const translationQuery = `
                            SELECT 
                                word_in_german,
                                word_in_english,
                                word_in_vietnamese,
                                word_in_arabic,
                                base_form_of_german_word
                            FROM our_vocabulary_list
                            WHERE word_in_german = $1 OR base_form_of_german_word = $1
                            LIMIT 1
                        `;
                        const translationResult = await req.db.query(translationQuery, [germanWord]);
                        return translationResult.rows[0] || null;
                    })
                );
                
                return {
                    ...wordRow,
                    germanWords,
                    translations: translations.filter(t => t !== null)
                };
            })
        );
        
        res.json({
            success: true,
            videoId: youtubeVideoId,
            words: wordsWithTranslations,
            count: wordsResult.rowCount
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

// Get all vocabulary with translations
router.get('/all', isAuthenticated, async (req, res) => {
    try {
        // Check structure of our_vocabulary_list
        const tableInfo = await req.db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'our_vocabulary_list' 
            ORDER BY ordinal_position
        `);
        
        console.log('our_vocabulary_list columns:', tableInfo.rows);
        
        // Get sample data
        const vocabQuery = `
            SELECT * 
            FROM our_vocabulary_list 
            LIMIT 10
        `;
        
        const vocabResult = await req.db.query(vocabQuery);
        
        res.json({
            success: true,
            tableStructure: tableInfo.rows,
            vocabulary: vocabResult.rows,
            count: vocabResult.rowCount
        });
        
    } catch (error) {
        console.error('Error fetching vocabulary list:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch vocabulary list',
            details: error.message 
        });
    }
});

// Check if video has vocabulary
router.get('/check/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.params;
        
        const checkQuery = `
            SELECT COUNT(*) as word_count
            FROM our_word_list 
            WHERE video_id = $1
        `;
        
        const result = await req.db.query(checkQuery, [videoId]);
        const hasVocabulary = result.rows[0].word_count > 0;
        
        res.json({
            success: true,
            hasVocabulary,
            wordCount: parseInt(result.rows[0].word_count)
        });
        
    } catch (error) {
        console.error('Error checking vocabulary:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check vocabulary'
        });
    }
});

module.exports = router; 