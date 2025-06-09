# LearnAndEarn Platform - Node.js Migration

## Project Overview
LearnAndEarn is a German language learning platform originally built with Odoo, now migrated to Node.js. The platform focuses on video-based learning with interactive dictation exercises using speech recognition, vocabulary practice, and cloze tests.

## Current Status (June 9, 2025)

### ✅ Completed Features

#### 1. Core Infrastructure
- **Backend**: Node.js with Express server
- **Database**: PostgreSQL (existing Odoo database "jetzt" on port 3143)
- **Frontend**: Vanilla JavaScript with modern CSS (Inter font family)
- **Authentication**: Session-based with bcrypt password hashing and JWT tokens
- **GitHub Repository**: https://github.com/lebenlernen/LearnAndEarn

#### 2. Modern UI/UX Design
- **Home Page**: Beautiful landing page explaining platform features
- **Navigation**: Consistent header with Home, Video Search, and My Progress links
- **Design System**: 
  - Inter font family for modern typography
  - Soft background colors (#f0f2f5)
  - Enhanced buttons with shadows and hover effects
  - Rounded corners and smooth transitions
  - Responsive layout

#### 3. Video Search & Discovery
- Grid-based video gallery (25 videos per page)
- Search by title and description
- Category filtering from `_type` column
- **Feature Filters** (NEW):
  - Vokabeln (Vocabulary)
  - Lückentexte (Cloze Tests)
  - Questions
- Pagination with page numbers
- Clickable video cards with feature indicators
- Visual checkmarks showing available exercises per video

#### 4. Video Detail Page
- YouTube video player integration
- Metadata display (title, description, creator, date)
- Summary section with fallback logic:
  - Primary: `our_video_summary` table
  - Fallback: `pure_subtitle` 
  - Default: "No summary available"
- **New Sections** (Layout ready):
  - Vokabeln (Vocabulary) - Coming soon
  - Lückentexte (Cloze Tests) - Coming soon

#### 5. Interactive Dictation Feature
- **Clickable sentences** in video summaries
- **Speech recognition** in German (Web Speech API)
- **Audio playback** at normal and slow speeds (Fixed button issue)
- **Real-time feedback** with color coding:
  - Green: Correct word in correct position
  - Orange: Word exists but wrong position
  - Red: Incorrect word
  - CAPITALS: Missing words (connection issues)
- **Partial sentence selection** for practicing specific phrases
- **Connection issue handling**: Accepts up to 3 missing starting words

#### 6. Multi-Role User System
- **Role-based access control**:
  - Student (default for new users)
  - Teacher
  - Admin
- **Many-to-many role relationships** (users can have multiple roles)
- **Admin Panel** at `/admin.html`:
  - View all users and their roles
  - Edit user roles (checkbox interface)
  - Activate/deactivate users
  - Access from profile page (admin only)
- **Profile Management**:
  - Update username, email, country, mother language, timezone
  - Change password
  - View assigned roles

#### 7. Learning Progress Tracking
- **Practice session recording** with detailed metrics
- **Aggregated progress statistics**
- **Problem sentence identification** (< 70% accuracy)
- **Progress dashboard** showing:
  - Overall statistics
  - Daily activity chart
  - Video-specific progress
  - Problem sentences needing work
- **Practice History Modal** with attempt counts

#### 8. Authentication & User Management
- Registration and login functionality
- Password hashing with bcrypt
- Session persistence (7 days) with PostgreSQL store
- JWT tokens for API authentication
- Profile fields: country, mother_language, timezone
- Admin user: thomas.seewald@gmail.com / Dresdner

### 🌐 API Endpoints

#### Public Endpoints
- `GET /api/categories` - List video categories
- `GET /api/videos/search` - Search videos with filters (includes feature filters)
- `GET /api/videos/:videoId` - Get video details

#### Protected Endpoints (Login Required)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info
- `POST /api/auth/change-password` - Change password
- `PUT /api/auth/profile` - Update user profile
- `GET /api/progress/stats` - User statistics
- `GET /api/progress/daily-activity` - Daily practice data
- `GET /api/progress/video-progress` - Per-video progress
- `GET /api/progress/problem-sentences` - Sentences needing practice
- `POST /api/progress/practice` - Save practice session
- `POST /api/progress/sentence-history` - Get sentence history

#### Admin Endpoints
- `GET /api/admin/users` - List all users with roles
- `PUT /api/admin/users/:userId` - Update user status and roles

### 📁 File Structure
```
LearnAndEarn/
├── app.js                 # Main Express server
├── .env                   # Environment configuration
├── package.json           # Node dependencies (name: learnandearn)
├── .gitignore            # Git ignore file
├── description.md        # This file
├── database/
│   ├── schema.sql        # Database schema
│   ├── setup.sql         # Initial setup scripts
│   └── migrations/       # Database migrations
├── middleware/
│   ├── auth.js          # Authentication middleware
│   └── admin.js         # Admin authorization middleware
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── progress.js      # Progress tracking routes
│   └── admin.js         # Admin management routes
└── public/
    ├── home.html        # Landing page (NEW)
    ├── search.html      # Video search page (renamed from index.html)
    ├── detail.html      # Video detail page
    ├── progress.html    # Progress dashboard
    ├── profile.html     # User profile page
    ├── admin.html       # Admin panel
    ├── login.html       # Login page
    ├── style.css        # Main styles
    ├── auth.css         # Authentication styles
    ├── progress.css     # Progress page styles
    ├── script.js        # Search page JavaScript
    ├── detail.js        # Detail page JavaScript
    ├── progress.js      # Progress page JavaScript
    ├── profile.js       # Profile page JavaScript
    ├── admin.js         # Admin panel JavaScript
    └── auth.js          # Authentication JavaScript
```

### 🗄️ Database Tables (our_* prefix)
- `our_videos` - Video metadata
- `our_video_summary` - Video summaries
- `our_video_question` - Questions for videos
- `our_video_cloze` - Cloze tests
- `our_vocabulary_list` - Vocabulary lists
- `our_users` - User accounts (with profile fields)
- `our_sessions` - Active sessions
- `our_roles` - Available roles (student, teacher, admin)
- `our_user_roles` - User-role relationships
- `our_user_learning_progress` - Overall user progress
- `our_practice_sessions` - Individual practice attempts
- `our_user_video_progress` - Per-video progress
- `our_problem_sentences` - Sentences with low accuracy

### 🔧 Recent Updates (June 9, 2025)
1. **Home Page**: Created modern landing page with feature explanations
2. **Navigation Overhaul**: 
   - Renamed index.html to search.html
   - Added consistent navigation header across all pages
   - Moved admin link to profile page
3. **Multi-Role System**: 
   - Implemented many-to-many role relationships
   - Created admin panel for user management
   - All new users start as students
4. **Feature Sections**: 
   - Added Vokabeln and Lückentexte sections to detail page
   - Created filter checkboxes on search page
   - Added Questions as third feature type
5. **UI Improvements**:
   - Updated to Inter font family
   - Modernized color scheme and styling
   - Enhanced buttons and form elements
6. **Bug Fixes**:
   - Fixed speech synthesis button issue in modal
   - Resolved session saving problems
   - Fixed admin access authorization
7. **GitHub Integration**: 
   - Initialized repository
   - Created comprehensive .gitignore
   - Multiple commits documenting progress

### 🚀 Running the Application
```bash
cd /Users/thomassee/Docker/containers/LearnAndEarn
npm start  # or node app.js
```
Server runs on: http://localhost:3000

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

### 🎯 Key Features for Teachers
- Complete practice history with timestamps
- Student role management through admin panel
- Problem sentence identification
- Progress tracking and statistics
- Student performance analytics
- Future: Dedicated teacher dashboard

### 💡 Technical Decisions
- Kept existing PostgreSQL database structure
- Used "our_" prefix for all new tables
- Hybrid auth: Sessions + JWT tokens
- Vanilla JavaScript (no frameworks)
- Server-side rendering with static files
- Role-based middleware for authorization
- Git repository for version control

### 🐛 Known Issues
- Country, mother_language, timezone fields need migration (error in logs)
- Feature filters need backend implementation
- Vocabulary and cloze test content not yet implemented

## Next Steps / Future Enhancements
- Implement vocabulary exercises
- Implement cloze test functionality
- Add questions feature
- Teacher dashboard with class management
- Export progress reports
- Mobile app development
- Gamification elements
- Multi-language support beyond German