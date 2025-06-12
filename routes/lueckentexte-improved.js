const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const axios = require('axios');

// SpaCy API base URL
const SPACY_API_URL = process.env.SPACY_API_URL || 'http://localhost:8001';

// Process sentence with SpaCy and store tokens
router.post('/process-and-store-sentence', isAuthenticated, async (req, res) => {
    try {
        const { sentenceId, sentence } = req.body;
        
        if (!sentence) {
            return res.status(400).json({
                success: false,
                error: 'Sentence is required'
            });
        }
        
        try {
            // Process with SpaCy
            const response = await axios.post(`${SPACY_API_URL}/process_sentence`, {
                text: sentence
            });
            
            const tokens = response.data.tokens || [];
            
            // Store tokens in database
            if (sentenceId && tokens.length > 0) {
                // Clear existing tokens for this sentence
                await req.db.query(
                    'DELETE FROM our_video_sentence_tokens WHERE sentence_id = $1',
                    [sentenceId]
                );
                
                // Insert new tokens
                for (const token of tokens) {
                    await req.db.query(`
                        INSERT INTO our_video_sentence_tokens 
                        (sentence_id, token_index, text, text_lower, lemma, pos, tag, dep, is_stop, is_punct, is_space)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [
                        sentenceId,
                        token.index,
                        token.text,
                        token.text.toLowerCase(),
                        token.lemma,
                        token.pos,
                        token.tag,
                        token.dep,
                        token.is_stop,
                        token.is_punct,
                        token.is_space || false
                    ]);
                }
            }
            
            res.json({
                success: true,
                tokens: tokens,
                sentenceId: sentenceId
            });
            
        } catch (spacyError) {
            console.error('SpaCy processing error:', spacyError);
            res.status(500).json({
                success: false,
                error: 'Failed to process sentence with SpaCy'
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

// Get sentences with tokens for specific exercise type
router.get('/sentences-with-tokens/:videoId/:type', isAuthenticated, async (req, res) => {
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
        
        // Build query based on exercise type
        let tokenQuery = '';
        let queryParams = [youtubeVideoId, limit];
        
        switch(type) {
            case 'verben':
                tokenQuery = `
                    SELECT DISTINCT s.id, s.sentence, 
                           COUNT(DISTINCT t.id) as verb_count
                    FROM our_video_sentences s
                    JOIN our_video_sentence_tokens t ON s.id = t.sentence_id
                    WHERE s.video_id = $1
                    AND t.pos IN ('VERB', 'AUX')
                    AND t.is_punct = false
                    GROUP BY s.id, s.sentence
                    HAVING COUNT(DISTINCT t.id) > 0
                    ORDER BY s.id
                    LIMIT $2
                `;
                break;
                
            case 'substantive':
                tokenQuery = `
                    SELECT DISTINCT s.id, s.sentence,
                           COUNT(DISTINCT t.id) as noun_count
                    FROM our_video_sentences s
                    JOIN our_video_sentence_tokens t ON s.id = t.sentence_id
                    WHERE s.video_id = $1
                    AND t.pos IN ('NOUN', 'PROPN')
                    AND t.is_punct = false
                    GROUP BY s.id, s.sentence
                    HAVING COUNT(DISTINCT t.id) > 0
                    ORDER BY s.id
                    LIMIT $2
                `;
                break;
                
            case 'adjektive':
                tokenQuery = `
                    SELECT DISTINCT s.id, s.sentence,
                           COUNT(DISTINCT t.id) as adj_count
                    FROM our_video_sentences s
                    JOIN our_video_sentence_tokens t ON s.id = t.sentence_id
                    WHERE s.video_id = $1
                    AND t.pos IN ('ADJ', 'ADV')
                    AND t.is_punct = false
                    GROUP BY s.id, s.sentence
                    HAVING COUNT(DISTINCT t.id) > 0
                    ORDER BY s.id
                    LIMIT $2
                `;
                break;
                
            default:
                // Return all sentences
                tokenQuery = `
                    SELECT id, sentence
                    FROM our_video_sentences
                    WHERE video_id = $1
                    ORDER BY id
                    LIMIT $2
                `;
        }
        
        const sentences = await req.db.query(tokenQuery, queryParams);
        
        // For each sentence, get its tokens
        const sentencesWithTokens = [];
        for (const sent of sentences.rows) {
            const tokensQuery = `
                SELECT token_index, text, lemma, pos, tag, is_stop, is_punct
                FROM our_video_sentence_tokens
                WHERE sentence_id = $1
                ORDER BY token_index
            `;
            const tokens = await req.db.query(tokensQuery, [sent.id]);
            
            sentencesWithTokens.push({
                id: sent.id,
                sentence: sent.sentence,
                tokens: tokens.rows
            });
        }
        
        res.json({
            success: true,
            sentences: sentencesWithTokens,
            type: type
        });
        
    } catch (error) {
        console.error('Error fetching sentences with tokens:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sentences'
        });
    }
});

// Analyze sentence on-the-fly for exercise creation
router.post('/analyze-for-exercise', isAuthenticated, async (req, res) => {
    try {
        const { sentence, exerciseType } = req.body;
        
        if (!sentence) {
            return res.status(400).json({
                success: false,
                error: 'Sentence is required'
            });
        }
        
        // Process with SpaCy
        const response = await axios.post(`${SPACY_API_URL}/process_sentence`, {
            text: sentence
        });
        
        const tokens = response.data.tokens || [];
        
        // Filter tokens based on exercise type
        const targetTokens = [];
        const allTokens = [];
        
        tokens.forEach((token, index) => {
            // Skip spaces and punctuation for word selection
            if (token.is_space || token.is_punct) {
                allTokens.push(token);
                return;
            }
            
            allTokens.push(token);
            
            // Check if this token matches the exercise type
            let isTarget = false;
            
            switch(exerciseType) {
                case 'artikel':
                    // Articles (definite and indefinite)
                    const articles = ['der', 'die', 'das', 'den', 'dem', 'des', 
                                    'ein', 'eine', 'einen', 'einem', 'einer', 'eines'];
                    isTarget = articles.includes(token.text.toLowerCase());
                    break;
                    
                case 'verben':
                    // Verbs (but not nominalized verbs)
                    isTarget = (token.pos === 'VERB' || token.pos === 'AUX') && 
                             token.text[0] === token.text[0].toLowerCase();
                    break;
                    
                case 'substantive':
                    // Nouns (including nominalized verbs like "das Spielen")
                    isTarget = token.pos === 'NOUN' || token.pos === 'PROPN';
                    break;
                    
                case 'adjektive':
                    // Adjectives and adverbs
                    isTarget = token.pos === 'ADJ' || token.pos === 'ADV';
                    break;
                    
                case 'schwierig':
                    // Long or compound words
                    isTarget = token.text.length > 8 || token.text.includes('-');
                    break;
            }
            
            if (isTarget) {
                targetTokens.push({
                    ...token,
                    tokenIndex: index
                });
            }
        });
        
        res.json({
            success: true,
            sentence: sentence,
            allTokens: allTokens,
            targetTokens: targetTokens,
            exerciseType: exerciseType
        });
        
    } catch (error) {
        console.error('Error analyzing sentence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze sentence'
        });
    }
});

// Batch process all sentences for a video
router.post('/process-video-sentences', isAuthenticated, async (req, res) => {
    try {
        const { videoId } = req.body;
        
        // Get all sentences for the video
        const sentencesQuery = `
            SELECT s.id, s.sentence, v.video_id as youtube_id
            FROM our_video_sentences s
            JOIN our_videos v ON s.video_id = v.video_id
            WHERE v.id = $1
            ORDER BY s.id
        `;
        const sentences = await req.db.query(sentencesQuery, [videoId]);
        
        let processed = 0;
        let errors = 0;
        
        for (const sent of sentences.rows) {
            try {
                // Check if already processed
                const checkQuery = `
                    SELECT COUNT(*) as count 
                    FROM our_video_sentence_tokens 
                    WHERE sentence_id = $1
                `;
                const check = await req.db.query(checkQuery, [sent.id]);
                
                if (check.rows[0].count > 0) {
                    console.log(`Sentence ${sent.id} already processed, skipping...`);
                    processed++;
                    continue;
                }
                
                // Process with SpaCy
                const response = await axios.post(`${SPACY_API_URL}/process_sentence`, {
                    text: sent.sentence
                });
                
                const tokens = response.data.tokens || [];
                
                // Store tokens
                for (const token of tokens) {
                    await req.db.query(`
                        INSERT INTO our_video_sentence_tokens 
                        (sentence_id, token_index, text, text_lower, lemma, pos, tag, dep, is_stop, is_punct)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (sentence_id, token_index) DO NOTHING
                    `, [
                        sent.id,
                        token.index,
                        token.text,
                        token.text.toLowerCase(),
                        token.lemma,
                        token.pos,
                        token.tag,
                        token.dep,
                        token.is_stop,
                        token.is_punct
                    ]);
                }
                
                processed++;
                
            } catch (err) {
                console.error(`Error processing sentence ${sent.id}:`, err);
                errors++;
            }
        }
        
        res.json({
            success: true,
            totalSentences: sentences.rows.length,
            processed: processed,
            errors: errors
        });
        
    } catch (error) {
        console.error('Error processing video sentences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process video sentences'
        });
    }
});

module.exports = router;