# LearnAndEarn Platform - Node.js Migration

## Project Overview
LearnAndEarn is a German language learning platform originally built with Odoo, now migrated to Node.js. The platform focuses on video-based learning with interactive dictation exercises using speech recognition.

## Current Status (June 7, 2025)

### ✅ Completed Features

#### 1. Core Infrastructure
- **Backend**: Node.js with Express server
- **Database**: PostgreSQL (existing Odoo database "jetzt" on port 3143)
- **Frontend**: Vanilla JavaScript with modern CSS
- **Authentication**: Session-based with bcrypt password hashing

#### 2. Video Search & Discovery
- Grid-based video gallery (25 videos per page)
- Search by title and description
- Category filtering from `_type` column
- Pagination with page numbers
- Clickable video cards leading to detail pages

#### 3. Video Detail Page
- YouTube video player integration
- Metadata display (title, description, creator, date)
- Summary section with fallback logic:
  - Primary: `our_video_summary` table
  - Fallback: `pure_subtitle` 
  - Default: "No summary available"

#### 4. Interactive Dictation Feature
- **Clickable sentences** in video summaries
- **Speech recognition** in German (Web Speech API)
- **Audio playback** at normal and slow speeds
- **Real-time feedback** with color coding:
  - Green: Correct word in correct position
  - Orange: Word exists but wrong position
  - Red: Incorrect word
  - CAPITALS: Missing words (connection issues)
- **Partial sentence selection** for practicing specific phrases
- **Connection issue handling**: Accepts up to 3 missing starting words

#### 5. User Authentication System
- Registration and login functionality
- Password hashing with bcrypt
- Session persistence (7 days)
- Role-based access (user/admin roles)
- Default admin account: admin@learnandearn.com / admin123
- Change password functionality

#### 6. Learning Progress Tracking
- **Practice session recording** with detailed metrics
- **Aggregated progress statistics**
- **Problem sentence identification** (< 70% accuracy)
- **Progress dashboard** showing:
  - Overall statistics
  - Recent activity chart
  - Most practiced videos
  - Problem sentences needing work

#### 7. Practice History
- **Per-sentence history** viewable in dictation modal
- **Complete timestamps** for teacher review
- **German date/time formatting**
- **Attempt counter** showing previous tries
- Sessions with connection issues are NOT saved

### 🌐 API Endpoints

#### Public Endpoints
- `GET /api/categories` - List video categories
- `GET /api/videos/search` - Search videos with filters
- `GET /api/videos/:videoId` - Get video details

#### Protected Endpoints (Login Required)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info
- `POST /api/auth/change-password` - Change password
- `GET /api/progress/stats` - User statistics
- `GET /api/progress/recent` - Recent activity
- `GET /api/progress/problem-sentences` - Sentences needing practice
- `POST /api/progress/practice` - Save practice session
- `POST /api/progress/sentence-history` - Get sentence history

### 📁 File Structure
```
LearnAndEarn/
├── app.js                 # Main Express server
├── .env                   # Environment configuration
├── package.json           # Node dependencies
├── database/
│   ├── schema.sql         # Database schema
│   └── setup.sql          # Initial setup scripts
├── middleware/
│   └── auth.js           # Authentication middleware
├── routes/
│   ├── auth.js           # Authentication routes
│   └── progress.js       # Progress tracking routes
└── public/
    ├── index.html        # Video search page
    ├── detail.html       # Video detail page
    ├── progress.html     # Progress dashboard
    ├── style.css         # Main styles
    ├── progress.css      # Progress page styles
    ├── script.js         # Search page JavaScript
    ├── detail.js         # Detail page JavaScript
    └── progress.js       # Progress page JavaScript
```

### 🗄️ Database Tables (our_* prefix)
- `our_videos` - Video metadata
- `our_video_summary` - Video summaries
- `our_users` - User accounts
- `our_sessions` - Active sessions
- `our_user_learning_progress` - Overall user progress
- `our_practice_sessions` - Individual practice attempts
- `our_user_video_progress` - Per-video progress
- `our_problem_sentences` - Sentences with low accuracy

### 🔧 Recent Updates
1. **German UI Translation**: All interface elements now in German
2. **Connection Issue Tolerance**: Increased to 3 missing words
3. **Session Filtering**: Connection issue attempts not saved to history
4. **Attempt Counter**: Shows "Bisherige Versuche: X" in dictation modal
5. **Timezone Fix**: Corrected UTC timestamp handling to display in Europe/Berlin timezone

### 🚀 Running the Application
```bash
cd /Users/thomassee/Docker/containers/LearnAndEarn
node app.js
```
Server runs on: http://localhost:3000

### 🔧 Database Timezone Fix
To ensure proper timezone handling:
```bash
cd /Users/thomassee/Docker/containers/LearnAndEarn/database
node run-timezone-fix.js
```
This converts timestamp columns to TIMESTAMPTZ for proper timezone support.

### 🔐 Environment Variables
```
DB_HOST=localhost
DB_PORT=3143
DB_NAME=jetzt
DB_USER=odoo
DB_PASSWORD=[configured]
SESSION_SECRET=[configured]
```

### 📱 Browser Compatibility
- **Full support**: Chrome, Edge, Safari (speech recognition)
- **Limited support**: Firefox (no speech recognition)

### 🎯 Key Features for Teachers/Parents
- Complete practice history with timestamps
- Professional date/time formatting for review
- Problem sentence identification
- Progress tracking and statistics
- Student performance analytics

### 💡 Technical Decisions
- Kept existing PostgreSQL database structure
- Used "our_" prefix for all new tables
- Session-based auth (no JWT)
- Vanilla JavaScript (no frameworks)
- Server-side rendering with static files
- Automatic progress calculation via database triggers

### 🐛 Known Issues Fixed
- Database connection string issues
- Video detail page SQL type mismatches
- JOIN column naming conflicts
- Server restart requirements for new endpoints

## Next Steps / Future Enhancements
- Mobile app development
- Additional learning exercises
- Teacher dashboard
- Multi-language support
- Export progress reports
- Gamification elements