const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// Start a new activity session
router.post('/session/start', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, timestamp } = req.body;
        
        // Close any existing open sessions for this user
        await req.db.query(`
            UPDATE our_activity_sessions 
            SET session_end = CURRENT_TIMESTAMP,
                total_duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - session_start))::INTEGER
            WHERE user_id = $1 AND session_end IS NULL
        `, [userId]);
        
        // Create new session
        const result = await req.db.query(`
            INSERT INTO our_activity_sessions (user_id, session_start)
            VALUES ($1, $2)
            RETURNING id
        `, [userId, timestamp || new Date()]);
        
        const sessionId = result.rows[0].id;
        
        // Log initial page view
        await req.db.query(`
            INSERT INTO our_activity_log 
            (user_id, session_id, activity_type, activity_detail, page_url, timestamp)
            VALUES ($1, $2, 'page_view', $3, $4, $5)
        `, [userId, sessionId, JSON.stringify({ initial: true }), page, timestamp || new Date()]);
        
        res.json({ 
            success: true, 
            sessionId 
        });
        
    } catch (error) {
        console.error('Error starting activity session:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to start session' 
        });
    }
});

// End activity session
router.post('/session/end', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId, timestamp } = req.body;
        
        // Update session end time and calculate durations
        const result = await req.db.query(`
            UPDATE our_activity_sessions 
            SET session_end = $1,
                total_duration_seconds = EXTRACT(EPOCH FROM ($1 - session_start))::INTEGER,
                active_duration_seconds = (
                    SELECT COALESCE(SUM(duration_seconds), 0)::INTEGER
                    FROM our_activity_log
                    WHERE session_id = $2 
                    AND activity_type NOT IN ('idle_start', 'idle_end', 'tab_blur')
                ),
                idle_duration_seconds = (
                    SELECT COALESCE(SUM(duration_seconds), 0)::INTEGER
                    FROM our_activity_log
                    WHERE session_id = $2 
                    AND activity_type = 'idle_start'
                )
            WHERE id = $2 AND user_id = $3
            RETURNING *
        `, [timestamp || new Date(), sessionId, userId]);
        
        if (result.rows.length > 0) {
            // Update daily summary
            await updateDailySummary(userId, result.rows[0]);
        }
        
        res.json({ 
            success: true,
            session: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error ending activity session:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to end session' 
        });
    }
});

// Receive heartbeat
router.post('/heartbeat', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId, timestamp, isActive } = req.body;
        
        // Update session last activity
        await req.db.query(`
            UPDATE our_activity_sessions 
            SET last_heartbeat = $1
            WHERE id = $2 AND user_id = $3
        `, [timestamp || new Date(), sessionId, userId]);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Heartbeat failed' 
        });
    }
});

// Log activities
router.post('/log', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { activities } = req.body;
        
        if (!Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No activities provided' 
            });
        }
        
        // Process each activity
        for (const activity of activities) {
            const { sessionId, activity_type, activity_detail, timestamp } = activity;
            
            // Calculate duration based on previous activity
            const prevActivity = await req.db.query(`
                SELECT timestamp FROM our_activity_log
                WHERE session_id = $1 AND user_id = $2
                ORDER BY timestamp DESC
                LIMIT 1
            `, [sessionId, userId]);
            
            let duration = 0;
            if (prevActivity.rows.length > 0) {
                const prevTime = new Date(prevActivity.rows[0].timestamp);
                const currTime = new Date(timestamp);
                duration = Math.floor((currTime - prevTime) / 1000);
                
                // Cap duration at 5 minutes to avoid unrealistic values
                duration = Math.min(duration, 300);
            }
            
            // Insert activity log
            await req.db.query(`
                INSERT INTO our_activity_log 
                (user_id, session_id, activity_type, activity_detail, duration_seconds, page_url, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId, 
                sessionId, 
                activity_type, 
                JSON.stringify(activity_detail || {}),
                duration,
                activity_detail.page || null,
                timestamp
            ]);
            
            // Update session activity counts
            if (isLearningActivity(activity_type)) {
                await req.db.query(`
                    UPDATE our_activity_sessions
                    SET learning_activities = learning_activities + 1
                    WHERE id = $1
                `, [sessionId]);
            }
            
            if (activity_type === 'page_view') {
                await req.db.query(`
                    UPDATE our_activity_sessions
                    SET page_views = page_views + 1
                    WHERE id = $1
                `, [sessionId]);
            }
        }
        
        res.json({ 
            success: true,
            processed: activities.length
        });
        
    } catch (error) {
        console.error('Error logging activities:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to log activities' 
        });
    }
});

// Get user's learning time summary
router.get('/summary', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'week' } = req.query;
        
        // Get summary data
        const summaryResult = await req.db.query(`
            SELECT * FROM our_learning_time_summary
            WHERE user_id = $1
        `, [userId]);
        
        // Get period-specific data
        let periodData;
        if (period === 'day') {
            periodData = await req.db.query(`
                SELECT * FROM our_daily_activity_summary
                WHERE user_id = $1 AND activity_date = CURRENT_DATE
            `, [userId]);
        } else if (period === 'week') {
            periodData = await req.db.query(`
                SELECT 
                    SUM(total_time_seconds) as total_time,
                    SUM(active_time_seconds) as active_time,
                    SUM(learning_time_seconds) as learning_time,
                    COUNT(DISTINCT activity_date) as active_days
                FROM our_daily_activity_summary
                WHERE user_id = $1 
                AND activity_date >= CURRENT_DATE - INTERVAL '7 days'
            `, [userId]);
        } else if (period === 'month') {
            periodData = await req.db.query(`
                SELECT 
                    SUM(total_time_seconds) as total_time,
                    SUM(active_time_seconds) as active_time,
                    SUM(learning_time_seconds) as learning_time,
                    COUNT(DISTINCT activity_date) as active_days
                FROM our_daily_activity_summary
                WHERE user_id = $1 
                AND activity_date >= CURRENT_DATE - INTERVAL '30 days'
            `, [userId]);
        }
        
        res.json({
            success: true,
            summary: summaryResult.rows[0] || {},
            periodData: periodData.rows[0] || {}
        });
        
    } catch (error) {
        console.error('Error fetching activity summary:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch summary' 
        });
    }
});

// Get detailed activity history
router.get('/history', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate, activityType, limit = 100 } = req.query;
        
        let query = `
            SELECT 
                al.*,
                as.session_start,
                as.session_end
            FROM our_activity_log al
            JOIN our_activity_sessions as ON al.session_id = as.id
            WHERE al.user_id = $1
        `;
        const params = [userId];
        
        if (startDate) {
            params.push(startDate);
            query += ` AND al.timestamp >= $${params.length}`;
        }
        
        if (endDate) {
            params.push(endDate);
            query += ` AND al.timestamp <= $${params.length}`;
        }
        
        if (activityType) {
            params.push(activityType);
            query += ` AND al.activity_type = $${params.length}`;
        }
        
        query += ` ORDER BY al.timestamp DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
        
        const result = await req.db.query(query, params);
        
        res.json({
            success: true,
            activities: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching activity history:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch history' 
        });
    }
});

// Teacher endpoint: Get student activity
router.get('/students', isAuthenticated, async (req, res) => {
    try {
        // Check if user is a teacher
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        const result = await req.db.query(`
            SELECT * FROM teacher_student_activity
            ORDER BY last_active DESC
        `);
        
        res.json({
            success: true,
            students: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching student activity:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch student activity' 
        });
    }
});

// Admin endpoint: Get platform analytics
router.get('/analytics', isAuthenticated, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        const analytics = await req.db.query(`
            SELECT * FROM admin_platform_analytics
        `);
        
        // Get hourly activity pattern
        const hourlyPattern = await req.db.query(`
            SELECT 
                EXTRACT(HOUR FROM timestamp) as hour,
                COUNT(*) as activity_count
            FROM our_activity_log
            WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY hour
            ORDER BY hour
        `);
        
        // Get daily trend
        const dailyTrend = await req.db.query(`
            SELECT 
                activity_date,
                COUNT(DISTINCT user_id) as active_users,
                SUM(total_time_seconds) as total_time,
                SUM(learning_time_seconds) as learning_time
            FROM our_daily_activity_summary
            WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY activity_date
            ORDER BY activity_date
        `);
        
        res.json({
            success: true,
            analytics: analytics.rows[0] || {},
            hourlyPattern: hourlyPattern.rows,
            dailyTrend: dailyTrend.rows
        });
        
    } catch (error) {
        console.error('Error fetching platform analytics:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch analytics' 
        });
    }
});

// Helper functions
function isLearningActivity(activityType) {
    const learningTypes = [
        'vocabulary_practice',
        'sentence_practice',
        'word_selection',
        'cloze_test',
        'video_watch',
        'dictation'
    ];
    return learningTypes.includes(activityType);
}

async function updateDailySummary(userId, session) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        await req.db.query(`
            INSERT INTO our_daily_activity_summary 
            (user_id, activity_date, total_sessions, total_time_seconds, 
             active_time_seconds, learning_time_seconds)
            VALUES ($1, $2, 1, $3, $4, $5)
            ON CONFLICT (user_id, activity_date) DO UPDATE SET
                total_sessions = our_daily_activity_summary.total_sessions + 1,
                total_time_seconds = our_daily_activity_summary.total_time_seconds + $3,
                active_time_seconds = our_daily_activity_summary.active_time_seconds + $4,
                learning_time_seconds = our_daily_activity_summary.learning_time_seconds + $5
        `, [
            userId, 
            today, 
            session.total_duration_seconds || 0,
            session.active_duration_seconds || 0,
            session.learning_activities * 30 || 0 // Estimate 30 seconds per learning activity
        ]);
    } catch (error) {
        console.error('Error updating daily summary:', error);
    }
}

module.exports = router;