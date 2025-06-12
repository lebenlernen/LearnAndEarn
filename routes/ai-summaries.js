const express = require('express');
const router = express.Router();
const { requireAuth, isAdmin } = require('../middleware/auth');
const aiSummaryService = require('../services/ai-summary-service');
const pool = require('../config/database');

// Middleware to check if user is teacher or admin
const requireTeacherOrAdmin = (req, res, next) => {
    const roles = req.session.roles || [req.session.role || 'student'];
    if (roles.includes('teacher') || roles.includes('admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Nur für Lehrer und Administratoren' });
    }
};

// Generate AI summaries for a video
router.post('/generate', requireAuth, requireTeacherOrAdmin, async (req, res) => {
    const { videoId } = req.body;
    
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID required' });
    }
    
    const client = await pool.connect();
    
    try {
        // Start transaction
        await client.query('BEGIN');
        
        // Get video details
        const videoResult = await client.query(
            'SELECT video_id, title, pure_subtitle, language_target FROM our_videos WHERE video_id = $1',
            [videoId]
        );
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const video = videoResult.rows[0];
        
        // Check if already processed
        const existingResult = await client.query(
            'SELECT processing_status FROM our_video_ai_summaries WHERE video_id = $1',
            [videoId]
        );
        
        if (existingResult.rows.length > 0 && existingResult.rows[0].processing_status === 'processing') {
            return res.status(409).json({ error: 'Already processing' });
        }
        
        // Mark as processing
        await client.query(`
            INSERT INTO our_video_ai_summaries (video_id, processing_status)
            VALUES ($1, 'processing')
            ON CONFLICT (video_id) 
            DO UPDATE SET processing_status = 'processing', updated_at = NOW()
        `, [videoId]);
        
        await client.query('COMMIT');
        
        // Generate summaries (async - don't wait)
        processSummaries(videoId, video).catch(error => {
            console.error('Error processing summaries:', error);
        });
        
        res.json({ 
            message: 'AI summary generation started',
            videoId: videoId 
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error starting summary generation:', error);
        res.status(500).json({ error: 'Failed to start summary generation' });
    } finally {
        client.release();
    }
});

// Async function to process summaries
async function processSummaries(videoId, video) {
    const client = await pool.connect();
    
    try {
        // Generate summaries
        const summaries = await aiSummaryService.generateSummaries(
            video.title,
            video.pure_subtitle,
            video.language_target || 'de'
        );
        
        await client.query('BEGIN');
        
        // Update summary record
        await client.query(`
            UPDATE our_video_ai_summaries
            SET short_summary = $1,
                long_summary_raw = $2,
                ai_model = $3,
                ai_prompt_version = $4,
                processing_status = 'completed',
                updated_at = NOW()
            WHERE video_id = $5
        `, [
            summaries.shortSummary,
            summaries.longSummary,
            summaries.model,
            summaries.promptVersion,
            videoId
        ]);
        
        // Delete old AI sentences completely
        await client.query(`
            DELETE FROM our_video_sentences
            WHERE video_id = $1 AND source = 'ai_summary'
        `, [videoId]);
        
        // Insert new sentences
        for (const sentence of summaries.sentences) {
            await client.query(`
                INSERT INTO our_video_sentences 
                (video_id, sentence, sentence_index, word_count, source, is_active)
                VALUES ($1, $2, $3, $4, 'ai_summary', true)
            `, [
                videoId,
                sentence.text,
                sentence.index,
                sentence.wordCount
            ]);
        }
        
        await client.query('COMMIT');
        
    } catch (error) {
        await client.query('ROLLBACK');
        
        // Mark as failed
        await client.query(`
            UPDATE our_video_ai_summaries
            SET processing_status = 'failed',
                error_message = $1,
                updated_at = NOW()
            WHERE video_id = $2
        `, [error.message, videoId]);
        
        throw error;
    } finally {
        client.release();
    }
}

// Get summary status
router.get('/status/:videoId', requireAuth, async (req, res) => {
    const { videoId } = req.params;
    
    try {
        const result = await pool.query(`
            SELECT 
                processing_status,
                short_summary,
                ai_model,
                created_at,
                updated_at
            FROM our_video_ai_summaries
            WHERE video_id = $1
        `, [videoId]);
        
        if (result.rows.length === 0) {
            return res.json({ status: 'not_processed' });
        }
        
        const summary = result.rows[0];
        
        // If completed, also get sentence count
        if (summary.processing_status === 'completed') {
            const sentenceResult = await pool.query(`
                SELECT COUNT(*) as count
                FROM our_video_sentences
                WHERE video_id = $1 AND source = 'ai_summary' AND is_active = true
            `, [videoId]);
            
            summary.sentenceCount = parseInt(sentenceResult.rows[0].count);
        }
        
        res.json(summary);
        
    } catch (error) {
        console.error('Error getting summary status:', error);
        res.status(500).json({ error: 'Failed to get summary status' });
    }
});

// Get learning sentences for a video (AI or transcript)
router.get('/sentences/:videoId', requireAuth, async (req, res) => {
    const { videoId } = req.params;
    
    try {
        // First try AI sentences
        let result = await pool.query(`
            SELECT 
                id,
                sentence as text,
                sentence_index,
                word_count,
                source
            FROM our_video_sentences
            WHERE video_id = $1 
                AND source = 'ai_summary' 
                AND is_active = true
            ORDER BY sentence_index
        `, [videoId]);
        
        // If no AI sentences, fall back to transcript
        if (result.rows.length === 0) {
            result = await pool.query(`
                SELECT 
                    id,
                    sentence as text,
                    sentence_index,
                    word_count,
                    source
                FROM our_video_sentences
                WHERE video_id = $1 
                    AND source = 'transcript'
                ORDER BY sentence_index
            `, [videoId]);
        }
        
        res.json({
            sentences: result.rows,
            source: result.rows.length > 0 ? result.rows[0].source : 'none'
        });
        
    } catch (error) {
        console.error('Error getting sentences:', error);
        res.status(500).json({ error: 'Failed to get sentences' });
    }
});

// Regenerate summaries with different settings
router.post('/regenerate', requireAuth, requireTeacherOrAdmin, async (req, res) => {
    const { videoId, temperature, model } = req.body;
    
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID required' });
    }
    
    try {
        // Get video details
        const videoResult = await pool.query(
            'SELECT video_id, title, pure_subtitle, language_target FROM our_videos WHERE video_id = $1',
            [videoId]
        );
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const video = videoResult.rows[0];
        
        // Mark as processing
        await pool.query(`
            UPDATE our_video_ai_summaries
            SET processing_status = 'processing',
                updated_at = NOW()
            WHERE video_id = $1
        `, [videoId]);
        
        // Process async
        processSummaries(videoId, video).catch(error => {
            console.error('Error regenerating summaries:', error);
        });
        
        res.json({ 
            message: 'AI summary regeneration started',
            videoId: videoId 
        });
        
    } catch (error) {
        console.error('Error starting regeneration:', error);
        res.status(500).json({ error: 'Failed to start regeneration' });
    }
});

module.exports = router;