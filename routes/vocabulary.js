const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// Get vocabulary for a specific video
router.get('/video/:videoId', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.params;
        
        // First, let's check the structure of our_word_list
        const tableInfo = await req.db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'our_word_list' 
            ORDER BY ordinal_position
        `);
        
        console.log('our_word_list columns:', tableInfo.rows);
        
        // Try to get words for this video
        const wordsQuery = `
            SELECT * 
            FROM our_word_list 
            WHERE video_id = $1
            LIMIT 10
        `;
        
        const wordsResult = await req.db.query(wordsQuery, [videoId]);
        
        res.json({
            success: true,
            tableStructure: tableInfo.rows,
            words: wordsResult.rows,
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