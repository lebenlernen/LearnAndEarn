# SpaCy Vocabulary Features for LearnAndEarn

## Overview
This document describes the SpaCy-powered vocabulary processing and exercise features for the LearnAndEarn platform.

## Architecture
- **Node.js App** (Port 3000): Main application server
- **Python SpaCy API** (Port 8001): NLP processing server
- **PostgreSQL**: Shared database for both servers

## Setup Instructions

### 1. Create Database Tables
```bash
# Run the SQL scripts to create necessary tables
psql -h localhost -p 3143 -U odoo -d jetzt -f database/create_base_words_table.sql
psql -h localhost -p 3143 -U odoo -d jetzt -f database/create_sentences_table.sql
```

### 2. Start SpaCy API Server
```bash
# In the LearnAndEarn directory
./start_spacy_api.sh
```

This will:
- Create a Python virtual environment
- Install required packages
- Download the German SpaCy model (de_core_news_md)
- Start the API server on http://localhost:8001

### 3. Start Node.js App
```bash
# In another terminal
npm start
```

## Features

### 1. Video Processing
When a video is accessed, the system:
- Extracts text from `pure_subtitle` field
- Processes it with SpaCy to identify:
  - Individual words and their lemmas (base forms)
  - Part of speech (noun, verb, adjective, etc.)
  - Stop words
  - Word vectors for similarity
- Extracts sentences for exercises
- Stores everything in the database

### 2. Vocabulary Exercises
- **Word Lists**: Display German words with their linguistic properties
- **Cloze Tests**: Fill-in-the-blank exercises from real video sentences
- **Word Context**: See example sentences containing specific words
- **Similar Words**: Find semantically related words using word vectors

### 3. API Endpoints

#### SpaCy API (Python - Port 8001)
- `POST /process_video` - Process a video's subtitles
- `GET /vocabulary/{video_id}` - Get processed vocabulary
- `GET /cloze_tests/{video_id}` - Generate cloze tests
- `GET /word_context/{video_id}/{word}` - Get word examples
- `GET /similar_words/{word}` - Find similar words

#### Node.js API (Port 3000)
- `POST /api/spacy/process-video` - Trigger video processing
- `GET /api/spacy/vocabulary/:videoId` - Get vocabulary with automatic processing
- `GET /api/spacy/cloze-tests/:videoId` - Get cloze tests
- `POST /api/spacy/cloze-attempt` - Save user's cloze test attempt
- `GET /api/spacy/word-context/:videoId/:word` - Get word context
- `GET /api/spacy/similar-words/:word` - Get similar words

## Database Schema

### our_videos_base_words
Stores SpaCy-processed vocabulary:
- `video_id`: Reference to video
- `original_word`: Word as it appears in text
- `lemma`: Base form of the word
- `pos`: Part of speech (NOUN, VERB, etc.)
- `tag`: Detailed grammatical tag
- `is_stop_word`: Common word flag
- `has_vector`: Word embedding availability
- `vector_norm`: Word vector magnitude
- `frequency`: How often word appears

### our_video_sentences
Stores sentences for exercises:
- `video_id`: Reference to video
- `sentence`: Full sentence text
- `sentence_index`: Order in video
- `word_count`: Number of words
- `difficulty_level`: 1 (easy) to 3 (hard)

### our_cloze_attempts
Tracks user performance:
- `user_id`: Reference to user
- `sentence_id`: Reference to sentence
- `cloze_word`: The hidden word
- `user_answer`: What user typed
- `is_correct`: Whether answer was correct
- `time_taken_seconds`: Time to answer

## Usage Example

```javascript
// In the frontend JavaScript

// Get vocabulary for current video
const response = await fetch(`/api/spacy/vocabulary/${videoId}`);
const vocabulary = await response.json();

// Generate cloze tests
const clozeResponse = await fetch(`/api/spacy/cloze-tests/${videoId}?count=5`);
const clozeTests = await clozeResponse.json();

// Save cloze attempt
await fetch('/api/spacy/cloze-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        sentenceId: 123,
        clozeWord: 'lernen',
        userAnswer: 'lernen',
        timeTaken: 15
    })
});
```

## Development Notes

### Adding New Features
1. Add endpoint to Python SpaCy API
2. Add corresponding route in Node.js
3. Update frontend to use new feature

### Performance Considerations
- Videos are processed on first access
- Results are cached in database
- SpaCy medium model provides good balance of speed/accuracy

### Future Enhancements
- Grammar checking
- Writing exercises
- Pronunciation guides using IPA
- Difficulty scoring based on word frequency
- Spaced repetition for vocabulary learning