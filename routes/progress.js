const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Save a practice session
router.post('/practice', isAuthenticated, async (req, res) => {
    const {
        videoId,
        sentenceText,
        sentenceIndex,
        userSpeech,
        expectedText,
        accuracyScore,
        correctWords,
        totalWords,
        practiceDuration
    } = req.body;
    
    try {
        // Save practice session
        const result = await req.db.query(
            `INSERT INTO our_practice_sessions 
            (user_id, video_id, sentence_text, sentence_index, user_speech, 
             expected_text, accuracy_score, correct_words, total_words, practice_duration)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [
                req.session.userId,
                videoId,
                sentenceText,
                sentenceIndex || null,
                userSpeech,
                expectedText,
                accuracyScore,
                correctWords,
                totalWords,
                practiceDuration || null
            ]
        );
        
        // Update problem sentences tracking for low accuracy
        if (accuracyScore < 70) {
            await req.db.query(
                `INSERT INTO our_problem_sentences 
                (user_id, video_id, sentence_text, practice_count, best_accuracy, average_accuracy, last_practiced_at)
                VALUES ($1, $2, $3, 1, $4, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, video_id, sentence_text)
                DO UPDATE SET
                    practice_count = our_problem_sentences.practice_count + 1,
                    best_accuracy = GREATEST(our_problem_sentences.best_accuracy, $4),
                    average_accuracy = (
                        (our_problem_sentences.average_accuracy * our_problem_sentences.practice_count + $4) 
                        / (our_problem_sentences.practice_count + 1)
                    ),
                    last_practiced_at = CURRENT_TIMESTAMP`,
                [req.session.userId, videoId, sentenceText, accuracyScore]
            );
        }
        
        res.json({ 
            success: true, 
            practiceId: result.rows[0].id 
        });
    } catch (error) {
        console.error('Error saving practice session:', error);
        res.status(500).json({ error: 'Failed to save practice session' });
    }
});

// Get user progress for a specific video
router.get('/video/:videoId', isAuthenticated, async (req, res) => {
    const videoId = parseInt(req.params.videoId);
    
    try {
        // Get overall video progress
        const progressResult = await req.db.query(
            `SELECT * FROM our_user_video_progress 
             WHERE user_id = $1 AND video_id = $2`,
            [req.session.userId, videoId]
        );
        
        // Get recent practice sessions
        const sessionsResult = await req.db.query(
            `SELECT * FROM our_practice_sessions 
             WHERE user_id = $1 AND video_id = $2 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [req.session.userId, videoId]
        );
        
        // Get problem sentences for this video
        const problemsResult = await req.db.query(
            `SELECT * FROM our_problem_sentences 
             WHERE user_id = $1 AND video_id = $2 
             AND average_accuracy < 70
             ORDER BY average_accuracy ASC 
             LIMIT 5`,
            [req.session.userId, videoId]
        );
        
        res.json({
            progress: progressResult.rows[0] || null,
            recentSessions: sessionsResult.rows,
            problemSentences: problemsResult.rows
        });
    } catch (error) {
        console.error('Error fetching video progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// Get user's overall learning statistics
router.get('/stats', isAuthenticated, async (req, res) => {
    try {
        // Total practice time across all videos
        const totalTimeResult = await req.db.query(
            `SELECT 
                COUNT(DISTINCT video_id) as videos_practiced,
                SUM(total_practices) as total_practices,
                SUM(total_time_seconds) as total_time_seconds,
                AVG(average_accuracy) as overall_accuracy
             FROM our_user_video_progress 
             WHERE user_id = $1`,
            [req.session.userId]
        );
        
        // Videos with most practice time
        const topVideosResult = await req.db.query(
            `SELECT 
                p.*, 
                v.title,
                v._type as category
             FROM our_user_video_progress p
             JOIN our_videos v ON p.video_id = v.id
             WHERE p.user_id = $1
             ORDER BY p.total_time_seconds DESC
             LIMIT 5`,
            [req.session.userId]
        );
        
        // Recent activity
        const recentActivityResult = await req.db.query(
            `SELECT 
                DATE(created_at) as practice_date,
                COUNT(*) as sessions,
                SUM(practice_duration) as time_seconds,
                AVG(accuracy_score) as avg_accuracy
             FROM our_practice_sessions
             WHERE user_id = $1 
             AND created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(created_at)
             ORDER BY practice_date DESC`,
            [req.session.userId]
        );
        
        // Most problematic sentences across all videos
        const problemSentencesResult = await req.db.query(
            `SELECT 
                ps.*,
                v.title as video_title
             FROM our_problem_sentences ps
             JOIN our_videos v ON ps.video_id = v.id
             WHERE ps.user_id = $1
             AND ps.average_accuracy < 70
             ORDER BY ps.average_accuracy ASC
             LIMIT 10`,
            [req.session.userId]
        );
        
        res.json({
            totalStats: totalTimeResult.rows[0],
            topVideos: topVideosResult.rows,
            recentActivity: recentActivityResult.rows,
            problemSentences: problemSentencesResult.rows
        });
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get learning progress over time
router.get('/timeline', isAuthenticated, async (req, res) => {
    const { days = 30 } = req.query;
    
    try {
        const result = await req.db.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as practice_count,
                AVG(accuracy_score) as avg_accuracy,
                SUM(practice_duration) as total_seconds
             FROM our_practice_sessions
             WHERE user_id = $1 
             AND created_at >= CURRENT_DATE - INTERVAL '%s days'
             GROUP BY DATE(created_at)
             ORDER BY date ASC`,
            [req.session.userId, parseInt(days)]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Failed to fetch timeline' });
    }
});

// Get practice history for a specific sentence
router.post('/sentence-history', isAuthenticated, async (req, res) => {
    const { videoId, sentenceText } = req.body;
    
    if (!videoId || !sentenceText) {
        return res.status(400).json({ error: 'Video ID and sentence text are required' });
    }
    
    try {
        const result = await req.db.query(
            `SELECT 
                id,
                user_speech,
                expected_text,
                accuracy_score,
                correct_words,
                total_words,
                practice_duration,
                created_at
             FROM our_practice_sessions
             WHERE user_id = $1 
             AND video_id = $2
             AND sentence_text = $3
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.session.userId, videoId, sentenceText]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sentence history:', error);
        res.status(500).json({ error: 'Failed to fetch sentence history' });
    }
});

module.exports = router; 