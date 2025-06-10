const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
            hasQuestions = ''
        } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE 1=1';
        let havingClause = '';
        const params = [];
        const havingConditions = [];
        
        if (query) {
            params.push(`%${query}%`);
            whereClause += ` AND (v.title ILIKE $${params.length} OR v.description ILIKE $${params.length})`;
        }
        
        if (category) {
            params.push(category);
            whereClause += ` AND v._type = $${params.length}`;
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
        const countResult = await pool.query(countQuery, params);
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
                COALESCE(vs.summary, v.pure_subtitle, 'No summary available.') as summary
            FROM our_videos v
            LEFT JOIN our_video_summary vs ON v.id = vs.video
            WHERE v.id = $1
        `;
        
        const result = await pool.query(query, [videoId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        res.json(result.rows[0]);
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

// Start server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});