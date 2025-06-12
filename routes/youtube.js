const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const pool = require('../config/database');
const axios = require('axios');

// Middleware to check if user is teacher or admin
const requireTeacherOrAdmin = (req, res, next) => {
    const roles = req.session.roles || [req.session.role || 'student'];
    if (roles.includes('teacher') || roles.includes('admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Nur für Lehrer und Administratoren' });
    }
};

// Preview YouTube video and get transcript options
router.post('/preview', requireAuth, requireTeacherOrAdmin, async (req, res) => {
    const { videoId, url } = req.body;
    
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID erforderlich' });
    }
    
    try {
        // Call SpaCy API server for YouTube preview
        const spacyResponse = await axios.post('http://localhost:8001/youtube/preview', {
            video_id: videoId,
            url: url
        });
        
        res.json(spacyResponse.data);
        
    } catch (error) {
        console.error('Error previewing video:', error);
        if (error.response && error.response.status === 500) {
            res.status(500).json({ 
                error: 'Fehler beim Laden des Videos',
                message: error.response.data.detail || error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'Fehler beim Laden des Videos',
                message: error.message 
            });
        }
    }
});

// Add video to database
router.post('/add', requireAuth, requireTeacherOrAdmin, async (req, res) => {
    const { videoId, language = 'de' } = req.body;
    
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID erforderlich' });
    }
    
    try {
        // Call SpaCy API server to add video
        const spacyResponse = await axios.post('http://localhost:8001/youtube/add', {
            video_id: videoId,
            language: language
        });
        
        // Trigger AI summary generation after successful video addition
        try {
            const aiResponse = await axios.post('http://localhost:3000/api/ai-summaries/generate', {
                videoId: videoId
            }, {
                headers: {
                    'Cookie': req.headers.cookie // Pass along authentication
                }
            });
            console.log('AI summary generation triggered:', aiResponse.data);
        } catch (aiError) {
            console.error('Failed to trigger AI summary generation:', aiError.message);
            // Don't fail the whole request if AI generation fails
        }

        res.json({
            success: spacyResponse.data.success,
            videoId: spacyResponse.data.videoId,
            message: spacyResponse.data.message,
            aiProcessing: true
        });
        
    } catch (error) {
        console.error('Error adding video:', error);
        if (error.response) {
            if (error.response.status === 409) {
                res.status(409).json({ error: 'Video bereits vorhanden' });
            } else if (error.response.status === 400) {
                // Pass through 400 errors from SpaCy server
                res.status(400).json({ 
                    error: error.response.data.detail || 'Fehler beim Abrufen der Untertitel',
                    message: error.response.data.detail || error.message 
                });
            } else {
                res.status(error.response.status || 500).json({ 
                    error: 'Fehler beim Speichern des Videos',
                    message: error.response.data.detail || error.message 
                });
            }
        } else {
            res.status(500).json({ 
                error: 'Fehler beim Speichern des Videos',
                message: error.message 
            });
        }
    }
});

// Update existing video (regenerate AI summary)
router.post('/update', requireAuth, requireTeacherOrAdmin, async (req, res) => {
    const { videoId } = req.body;
    
    if (!videoId) {
        return res.status(400).json({ error: 'Video ID erforderlich' });
    }
    
    try {
        // Check if video exists
        const videoCheck = await pool.query(
            'SELECT video_id, title FROM our_videos WHERE video_id = $1',
            [videoId]
        );
        
        if (videoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Video nicht gefunden' });
        }
        
        // Trigger AI summary regeneration
        const aiResponse = await axios.post('http://localhost:3000/api/ai-summaries/regenerate', {
            videoId: videoId
        }, {
            headers: {
                'Cookie': req.headers.cookie // Pass along authentication
            }
        });
        
        res.json({
            success: true,
            message: 'AI-Zusammenfassung wird aktualisiert',
            videoId: videoId
        });
        
    } catch (error) {
        console.error('Error updating video:', error);
        res.status(500).json({ 
            error: 'Fehler beim Aktualisieren des Videos',
            message: error.message 
        });
    }
});

module.exports = router;