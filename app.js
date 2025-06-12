const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const http = require('http');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize WebSocket service
const webSocketService = require('./services/websocket-service');
webSocketService.initialize(server);

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3143,
    database: process.env.DB_DATABASE || 'jetzt',
    user: process.env.DB_USER || 'odoo',
    password: process.env.DB_PASSWORD || 'odoo',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully:', res.rows[0].now);
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'our_sessions',
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Allow cookies over HTTP for now
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax' // Add sameSite for better compatibility
    }
}));

// Make database available to routes
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Import auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Import progress routes
const progressRoutes = require('./routes/progress');
app.use('/api/progress', progressRoutes);

// Import admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Import vocabulary routes
const vocabularyRoutes = require('./routes/vocabulary');
app.use('/api/vocabulary', vocabularyRoutes);

// Import SpaCy routes
const spacyRoutes = require('./routes/spacy');
app.use('/api/spacy', spacyRoutes);

// Import activity tracking routes
const activityRoutes = require('./routes/activity');
app.use('/api/activity', activityRoutes);

// Import Lückentexte routes
const lueckentexteRoutes = require('./routes/lueckentexte');
app.use('/api/lueckentexte', lueckentexteRoutes);

// Import AI routes
const aiRoutes = require('./routes/ai-api');
app.use('/api/ai', aiRoutes);

// Import questions routes (using improved version)
const questionsRoutes = require('./routes/questions-improved');
app.use('/api/questions', questionsRoutes);

// Import YouTube routes
const youtubeRoutes = require('./routes/youtube');
app.use('/api/videos/youtube', youtubeRoutes);

// Import AI summaries routes
const aiSummariesRoutes = require('./routes/ai-summaries');
app.use('/api/ai-summaries', aiSummariesRoutes);

// Import school routes
const schoolRoutes = require('./routes/school');
app.use('/api/school', schoolRoutes);

// Import auth middleware
const { optionalAuth, isAuthenticated, isAdmin } = require('./middleware/auth');

// API Routes with optional auth (existing routes)
app.get('/api/categories', optionalAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT _type as category 
            FROM our_videos 
            WHERE _type IS NOT NULL AND _type != '' 
            ORDER BY _type
        `);
        
        res.json(result.rows.map(row => row.category));
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.get('/api/videos/search', optionalAuth, async (req, res) => {
    try {
        const { 
            query = '', 
            category = '', 
            page = 1, 
            limit = 25,
            hasVocabulary = '',
            hasClozeTest = '',
            hasQuestions = '',
            searchScope = 'all',
            subtitleQuality = ''
        } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE 1=1';
        let havingClause = '';
        const params = [];
        const havingConditions = [];
        
        if (query) {
            // Split query into individual words and use AND logic
            const searchWords = query.trim().split(/\s+/).filter(word => word.length > 0);
            
            if (searchWords.length > 0) {
                const wordConditions = searchWords.map(word => {
                    params.push(`%${word}%`);
                    const paramIndex = params.length;
                    
                    // Check search scope
                    switch (searchScope) {
                        case 'channel':
                            return `v.channel ILIKE $${paramIndex}`;
                        case 'title':
                            return `v.title ILIKE $${paramIndex}`;
                        case 'all':
                        default:
                            return `(v.title ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`;
                    }
                });
                
                // All words must be found (AND logic between words)
                whereClause += ` AND (${wordConditions.join(' AND ')})`;
            }
        }
        
        if (category) {
            params.push(category);
            whereClause += ` AND v._type = $${params.length}`;
        }
        
        // Handle subtitle quality filter
        if (subtitleQuality === 'manual') {
            // Manual subtitles: sub_manual = '2' (as text)
            whereClause += ` AND v.sub_manual = '2'`;
        } else if (subtitleQuality === 'auto') {
            // Auto-generated subtitles: sub_manual = '1' (as text)
            whereClause += ` AND v.sub_manual = '1'`;
        }
        
        // Handle feature filters
        if (hasVocabulary === 'true') {
            havingConditions.push('EXISTS(SELECT 1 FROM our_word_list wl WHERE wl.video_id = v.id::text)');
        }
        
        if (hasClozeTest === 'true') {
            havingConditions.push('EXISTS(SELECT 1 FROM our_video_cloze vc WHERE vc.video_id = v.id::text)');
        }
        
        if (hasQuestions === 'true') {
            havingConditions.push('EXISTS(SELECT 1 FROM our_video_question vq WHERE vq.video_id = v.id::text)');
        }
        
        if (havingConditions.length > 0) {
            whereClause += ' AND ' + havingConditions.join(' AND ');
        }
        
        // Get total count
        const countQuery = `SELECT COUNT(*) FROM our_videos v ${whereClause}`;
        
        // Debug logging
        if (subtitleQuality) {
            console.log('=== SUBTITLE FILTER DEBUG ===');
            console.log('Subtitle quality param:', subtitleQuality);
            console.log('Count query:', countQuery);
            console.log('Params:', params);
        }
        
        let countResult;
        try {
            countResult = await pool.query(countQuery, params);
        } catch (queryError) {
            console.error('Query error:', queryError.message);
            console.error('Failed query:', countQuery);
            console.error('With params:', params);
            throw queryError;
        }
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Get paginated results with feature indicators
        params.push(limit, offset);
        const dataQuery = `
            SELECT 
                v.id, 
                v.video_id, 
                v.title, 
                v.description, 
                v.channel, 
                v._type, 
                v.duration, 
                v.views,
                v.sub_manual,
                EXISTS(SELECT 1 FROM our_word_list wl WHERE wl.video_id = v.id::text) as "hasVocabulary",
                EXISTS(SELECT 1 FROM our_video_cloze vc WHERE vc.video_id = v.id::text) as "hasClozeTest",
                EXISTS(SELECT 1 FROM our_video_question vq WHERE vq.video_id = v.id::text) as "hasQuestions"
            FROM our_videos v
            ${whereClause}
            ORDER BY v.id DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;
        const dataResult = await pool.query(dataQuery, params);
        
        res.json({
            videos: dataResult.rows,
            totalCount,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Failed to search videos' });
    }
});

app.get('/api/videos/:videoId', optionalAuth, async (req, res) => {
    try {
        const videoId = parseInt(req.params.videoId);
        
        // Validate that videoId is a valid number
        if (isNaN(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        const query = `
            SELECT 
                v.id,
                v.video_id,
                v.title,
                v.description,
                v.channel,
                v._type,
                v.duration,
                v.views,
                v.subtitle,
                v.pure_subtitle,
                v.sub_manual,
                COALESCE(vs.summary, v.pure_subtitle, 'No summary available.') as summary
            FROM our_videos v
            LEFT JOIN our_video_summary vs ON v.id = vs.video
            WHERE v.id = $1
        `;
        
        const result = await pool.query(query, [videoId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const video = result.rows[0];
        
        // Try to get AI summary data
        try {
            const summaryResult = await pool.query(`
                SELECT 
                    short_summary,
                    long_summary_raw,
                    processing_status,
                    ai_model
                FROM our_video_ai_summaries
                WHERE video_id = $1
            `, [video.video_id]);
            
            if (summaryResult.rows.length > 0) {
                video.aiSummary = summaryResult.rows[0];
            }
            
            // Get learning sentences (AI or transcript)
            const sentencesQuery = `
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
            `;
            
            let sentencesResult = await pool.query(sentencesQuery, [video.video_id]);
            
            // Fall back to transcript sentences if no AI sentences
            if (sentencesResult.rows.length === 0) {
                const fallbackQuery = `
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
                `;
                sentencesResult = await pool.query(fallbackQuery, [video.video_id]);
            }
            
            if (sentencesResult.rows.length > 0) {
                video.learningSentences = sentencesResult.rows;
                video.sentenceSource = sentencesResult.rows[0].source;
            }
            
        } catch (error) {
            console.error('Error fetching AI summary data:', error);
            // Continue without AI data - not a fatal error
        }
        
        res.json(video);
    } catch (error) {
        console.error('Error fetching video details:', error);
        res.status(500).json({ error: 'Failed to fetch video details' });
    }
});

// Admin routes (example)
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, email, username, role, is_active, created_at 
            FROM our_users 
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Debug endpoint to check sub_manual values
app.get('/api/debug/sub-manual-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                sub_manual, 
                COUNT(*) as count
            FROM our_videos
            GROUP BY sub_manual
            ORDER BY sub_manual
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting sub_manual stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Make WebSocket service available to routes
app.set('wsService', webSocketService);

// Start server
server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`WebSocket server ready`);
});