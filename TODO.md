# LearnAndEarn Node.js Migration - TODO List

This document outlines the tasks required to migrate the LearnAndEarn Odoo project to Node.js.

## High Priority

- [x] Analyze existing Odoo 17.0 project structure and custom modules (especially `_our_seewald_youtube`).
- [x] Understand the PostgreSQL database schema and identify all relevant "our_" prefixed tables.
- [x] Set up a basic Node.js project environment for the migration. we start with a search interface over the videos.
- [x] Now lets understand the main exersice for students always used in all different exercises. Clicking on sentences opens a dictation window with the clicked text
- [x] Implement user authentication system with "our_" naming convention for tables
- [x] Implement multi-role system (student, teacher, admin)
- [x] Create admin panel for user management
- [x] Add navigation improvements and modern UI design

## In Progress

### Vokabeln (Vocabulary) with Spaced Repetition Learning 🚧

#### Core Principle: "Always Speaking" - ALL interactions must support speech input/output

#### Database Design Tasks
- [x] Analyze existing tables:
  - [x] `our_videos_base_words` - unique base words per video with SpaCy analysis
  - [x] `our_vocabulary_practice` - SRS tracking for user progress
- [x] Added `language_target` column to `our_videos_base_words` table
- [ ] Design solution for polysemous words (e.g., "Bank" = financial/bench)
- [x] Create word-video frequency tracking table (exists in base_words)
- [x] Design SRS tracking tables for user progress (our_vocabulary_practice)

#### Two Learning Modes
- [ ] **Word Mode**: Individual vocabulary with speech
  - [ ] Display word in context sentence
  - [ ] Play audio pronunciation
  - [ ] User speaks the word
  - [ ] Speech recognition validates
- [ ] **Sentence Mode**: Full sentences with vocabulary
  - [ ] Display complete sentence
  - [ ] Highlight target vocabulary
  - [ ] User speaks entire sentence
  - [ ] Color-coded feedback (like dictation)

#### Spaced Repetition Algorithm
- [ ] Implement SRS intervals (1, 3, 7, 14 days, etc.)
- [ ] Track per-user, per-word progress
- [ ] Failed attempts reset interval
- [ ] Success based on speech accuracy

#### Speech-First Features (CRITICAL)
- [ ] **Question Types** (all with speech):
  - [ ] "Wie sagt man [English] auf Deutsch?" → Speak German
  - [ ] "Was bedeutet [German sentence]?" → Speak translation
  - [ ] "Verwende [word] in einem Satz" → Create & speak sentence
- [ ] **Audio Feedback**:
  - [ ] Immediate playback of correct pronunciation
  - [ ] Slow/normal speed options
- [ ] **No Typing Required** - all answers via speech

#### Video Integration
- [ ] Link vocabulary to source video & timestamp
- [ ] "Jump to video" feature for context
- [ ] Extract sentences containing target words

#### Additional Considerations
- [ ] Handle compound words (Zusammengesetzte Wörter)
- [ ] Word frequency influences initial difficulty
- [ ] Group related words (word families)
- [ ] Multiple mother language support

## Completed Features

### Video Search Dashboard ✅
- Search functionality with pagination
- Category filtering
- Feature filters (Vokabeln, Lückentexte, Questions)
- Responsive grid layout
- Video detail pages with YouTube embedding

### Speech Recognition Dictation ✅
- Clickable sentences in summaries
- Partial sentence selection for focused practice
- Dual-speed audio playback (normal and slow)
- Real-time German speech recognition
- Automatic color-coded feedback:
  - Green: Words in correct position
  - Orange: Words exist but wrong position
  - Red: Incorrect words
- Browser compatibility with fallback messages
- Practice history tracking
- Fixed speech synthesis button issue

### User Authentication System ✅
- Database tables: our_users, our_sessions, our_user_learning_progress
- User registration with email/username validation
- Login with session management (7-day persistence)
- Multi-role system (student, teacher, admin)
- Password hashing with bcrypt
- Protected routes and admin endpoints
- Modern UI with tabbed login/register interface
- User status display on all pages
- Profile management with country, mother_language, timezone

### Progress Tracking ✅
- Practice session recording
- Daily activity charts
- Video-specific progress
- Problem sentence identification
- Sentence practice history

### UI/UX Improvements ✅
- Modern home page with feature explanations
- Consistent navigation across all pages
- Inter font family
- Improved color scheme and styling
- Admin panel accessible from profile page
- Removed feature checkmarks from search page (January 2025)
- Changed category filter to "Alles" (January 2025)
- Auto-focus system dictation input when text selected (January 2025)
- Added dictation button to cloze test sentences (January 2025)
- Added Enter key support for system dictation submission (January 2025)
- Fixed text selection with 5-second pause mechanism (January 2025)
- Added line breaks after punctuation in dictation sentences (January 2025)

## Medium Priority

- [x] Implement Lückentexte (Cloze Tests) with SpaCy - completed with exercise type selection
- [ ] Add speech input to Lückentexte exercises
- [ ] Implement Questions feature with speech answers
- [x] Fix database migration for country, mother_language, timezone fields
- [ ] Implement backend for feature filters (hasVocabulary, hasClozeTest, hasQuestions)
- [ ] Design the new Node.js application architecture, considering the existing Odoo functionalities.
- [x] Prepare Multi-Language Support Infrastructure:
    - [x] Updated database: Added language_target to our_videos_base_words (655,374 words updated)
    - [x] Created multi-language SpaCy API example (spacy_api_server_multilang_example.py)
    - [x] Created language checker script (scripts/check_spacy_languages.py)
    - [x] Documented SpaCy's 70+ language support capability
- [ ] Implement Multi-Language Support:
    - [ ] Install additional SpaCy models (en, es, fr, it)
    - [ ] Update API to handle multiple languages
    - [ ] Add language selector to UI
    - [ ] Adapt exercises for different languages
- [ ] Implement YouTube integration:
    - [ ] Extract transcripts from YouTube videos.
    - [ ] Create learning materials based on video content.
- [ ] Integrate AI Content Generation (OpenAI GPT-3.5 and DeepSeek APIs):
    - [ ] Develop modules for automatic summaries.
    - [ ] Develop modules for generating questions.
    - [ ] Develop modules for vocabulary extraction.

## Low Priority

- [ ] Teacher dashboard with class management
- [ ] Export progress reports
- [ ] Develop interactive exercise modules (additional types)
- [ ] Implement gamification features (points, badges, leaderboards)
- [ ] Mobile app development
- [ ] Plan and implement Dockerization for the new Node.js application
- [ ] Migrate or adapt existing test documentation and data for the Node.js environment 