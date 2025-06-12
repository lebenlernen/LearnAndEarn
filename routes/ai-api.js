const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const aiConfig = require('../config/ai-config');
const aiService = require('../services/ai-service');
const pool = require('../config/database');

// Debug endpoint to check auth
router.get('/debug-auth', requireAuth, (req, res) => {
    res.json({
        session: {
            userId: req.session.userId,
            username: req.session.username,
            role: req.session.role,
            roles: req.session.roles
        },
        user: req.user
    });
});

// Get current AI configuration
router.get('/config', ...requireAdmin, (req, res) => {
    try {
        const config = aiConfig.getActiveConfig();
        const providers = aiConfig.getAllProviders();
        
        res.json({
            current: {
                provider: config.provider,
                model: config.model,
                modelName: config.modelConfig.name
            },
            providers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update AI configuration
router.post('/config', ...requireAdmin, (req, res) => {
    try {
        const { provider, model } = req.body;
        
        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' });
        }
        
        const config = aiConfig.setActiveProvider(provider, model);
        
        res.json({
            message: 'AI configuration updated successfully',
            current: {
                provider: config.provider,
                model: config.model,
                modelName: config.modelConfig.name
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Test AI connection
router.post('/test', ...requireAdmin, async (req, res) => {
    try {
        const { testPrompt } = req.body;
        const prompt = testPrompt || 'Hello! Please respond with "AI connection successful" if you can read this.';
        
        const response = await aiConfig.askAI(prompt, {
            maxTokens: 100,
            temperature: 0.5
        });
        
        const config = aiConfig.getActiveConfig();
        
        res.json({
            success: true,
            provider: config.provider,
            model: config.model,
            response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Process a single video
router.post('/process-video', ...requireAdmin, async (req, res) => {
    try {
        const { videoId } = req.body;
        
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }
        
        const result = await aiService.processVideoWithAI(videoId);
        res.json(result);
    } catch (error) {
        console.error('Error processing video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get videos that need AI processing
router.get('/videos-to-process', ...requireAdmin, async (req, res) => {
    const client = await pool.connect();
    
    try {
        // Find videos with auto-subtitles that don't have AI questions yet
        const result = await client.query(`
            SELECT v.video_id, v.title, v.sub_manual, 
                   COUNT(q.id) as question_count,
                   LENGTH(v.pure_subtitle) as subtitle_length
            FROM our_videos v
            LEFT JOIN our_video_questions q ON v.video_id = q.video_id
            WHERE v.pure_subtitle IS NOT NULL
              AND v.pure_subtitle != ''
              AND (v.sub_manual != 1)
            GROUP BY v.video_id, v.title, v.sub_manual, v.pure_subtitle
            HAVING COUNT(q.id) = 0
            ORDER BY LENGTH(v.pure_subtitle) DESC
            LIMIT 20
        `);
        
        res.json({
            videos: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error finding videos to process:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get questions for a video
router.get('/questions/:videoId', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT question, options, correct_answer, question_type, 
                   difficulty, explanation, question_index
            FROM our_video_questions
            WHERE video_id = $1
            ORDER BY question_index
        `, [req.params.videoId]);
        
        res.json({
            videoId: req.params.videoId,
            questions: result.rows
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;