const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const axios = require('axios');

// SpaCy API base URL
const SPACY_API_URL = process.env.SPACY_API_URL || 'http://localhost:8001';

// Process sentence with SpaCy to get POS tags
router.post('/process-sentence', isAuthenticated, async (req, res) => {
    try {
        const { sentence, exerciseType } = req.body;
        
        if (!sentence) {
            return res.status(400).json({
                success: false,
                error: 'Sentence is required'
            });
        }
        
        try {
            // Try SpaCy API first
            const response = await axios.post(`${SPACY_API_URL}/process_sentence`, {
                text: sentence
            });
            
            const tokens = response.data.tokens || [];
            
            // Filter tokens based on exercise type
            const targetWords = tokens.filter(token => {
                switch(exerciseType) {
                    case 'verben':
                        return token.pos === 'VERB' || token.pos === 'AUX';
                    case 'substantive':
                        return token.pos === 'NOUN' || token.pos === 'PROPN';
                    case 'adjektive':
                        return token.pos === 'ADJ' || token.pos === 'ADV';
                    default:
                        return false;
                }
            });
            
            res.json({
                success: true,
                tokens: tokens,
                targetWords: targetWords
            });
            
        } catch (spacyError) {
            // Fallback without SpaCy
            console.log('SpaCy not available, using fallback');
            res.json({
                success: true,
                tokens: [],
                targetWords: [],
                fallback: true
            });
        }
        
    } catch (error) {
        console.error('Error processing sentence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process sentence'
        });
    }
});

// Get sentences with specific word types
router.get('/sentences-by-type/:videoId/:type', isAuthenticated, async (req, res) => {
    try {
        const { videoId, type } = req.params;
        const { limit = 10 } = req.query;
        
        // Get video's YouTube ID
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
        
        // Get sentences from database
        const sentencesQuery = `
            SELECT sentence 
            FROM our_video_sentences 
            WHERE video_id = $1
            ORDER BY id
            LIMIT $2
        `;
        const sentences = await req.db.query(sentencesQuery, [youtubeVideoId, limit]);
        
        // For now, return all sentences - filtering will be done on client
        res.json({
            success: true,
            sentences: sentences.rows,
            type: type
        });
        
    } catch (error) {
        console.error('Error fetching sentences by type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentences'
        });
    }
});

module.exports = router;