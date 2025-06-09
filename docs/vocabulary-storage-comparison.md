# Vocabulary Storage: JSON Field vs PostgreSQL Tables

## Current Data Structure
- ~200-400 words per video
- Linguistic features: lemma, POS, tag, vector norm
- Relationships: word → lemma → translations

## Option 1: JSON Field in `our_videos` Table

### Advantages:
- ✅ **Simple Implementation**: One column addition
- ✅ **Atomic Operations**: All vocabulary data in one place
- ✅ **Fast Retrieval**: Single query for video + vocabulary
- ✅ **Flexible Schema**: Easy to add new features
- ✅ **Good for Read-Heavy**: Excellent for displaying vocabulary

### Disadvantages:
- ❌ **Limited Querying**: Can't easily search across videos
- ❌ **No Indexing**: Can't index individual words/lemmas
- ❌ **Duplication**: Same lemmas stored multiple times
- ❌ **Size**: Large JSON fields (50-100KB per video)

### SQL Example:
```sql
ALTER TABLE our_videos 
ADD COLUMN vocabulary_data JSONB;

-- Query example
SELECT title, vocabulary_data->>'statistics' 
FROM our_videos 
WHERE video_id = 'xyz';
```

## Option 2: Normalized PostgreSQL Tables

### Proposed Schema:
```sql
-- Master lemma table (shared across all videos)
CREATE TABLE our_lemmas (
    id SERIAL PRIMARY KEY,
    lemma VARCHAR(255) UNIQUE NOT NULL,
    pos VARCHAR(50),
    is_common BOOLEAN DEFAULT FALSE,
    difficulty_level INTEGER, -- 1-5
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video-specific vocabulary
CREATE TABLE our_video_vocabulary (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) REFERENCES our_videos(video_id),
    lemma_id INTEGER REFERENCES our_lemmas(id),
    original_form VARCHAR(255),
    tag VARCHAR(50),
    frequency INTEGER DEFAULT 1,
    context_sentence TEXT,
    position_in_video INTEGER,
    UNIQUE(video_id, original_form)
);

-- Indexes for performance
CREATE INDEX idx_video_vocab_video ON our_video_vocabulary(video_id);
CREATE INDEX idx_video_vocab_lemma ON our_video_vocabulary(lemma_id);
CREATE INDEX idx_lemmas_pos ON our_lemmas(pos);
```

### Advantages:
- ✅ **Powerful Queries**: Find videos by vocabulary
- ✅ **No Duplication**: Lemmas stored once
- ✅ **Statistics**: Easy aggregation across videos
- ✅ **Relationships**: Link to translations table
- ✅ **Scalable**: Handles millions of words efficiently
- ✅ **Learning Analytics**: Track word frequency globally

### Disadvantages:
- ❌ **Complex Queries**: JOINs needed for full data
- ❌ **More Tables**: Increased complexity
- ❌ **Migration**: Need to transform existing data

## Hybrid Approach (Recommended) 🌟

### Best of Both Worlds:
```sql
-- 1. Normalized tables for querying and analytics
CREATE TABLE our_lemmas (...);
CREATE TABLE our_video_vocabulary (...);

-- 2. Materialized view or cache for fast retrieval
CREATE MATERIALIZED VIEW our_video_vocabulary_cache AS
SELECT 
    v.video_id,
    v.title,
    jsonb_agg(
        jsonb_build_object(
            'original', vv.original_form,
            'lemma', l.lemma,
            'pos', l.pos,
            'frequency', vv.frequency
        ) ORDER BY vv.frequency DESC
    ) as vocabulary_json
FROM our_videos v
JOIN our_video_vocabulary vv ON v.video_id = vv.video_id
JOIN our_lemmas l ON vv.lemma_id = l.id
GROUP BY v.video_id, v.title;

-- 3. Or add computed JSON column
ALTER TABLE our_videos 
ADD COLUMN vocabulary_cache JSONB;

-- Update via trigger or batch process
```

## Use Cases Comparison

| Use Case | JSON Field | PostgreSQL Tables | Hybrid |
|----------|------------|-------------------|---------|
| Display vocabulary for one video | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Find videos with specific words | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Global word statistics | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Update single word | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Storage efficiency | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Query performance | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Implementation complexity | ⭐⭐⭐ | ⭐ | ⭐⭐ |

## Recommendation

For LearnAndEarn, I recommend the **Hybrid Approach**:

1. **Immediate**: Add JSONB column for quick implementation
2. **Phase 2**: Create normalized tables for analytics
3. **Long-term**: Use both for optimal performance

This allows you to:
- Start using vocabulary features immediately
- Build advanced features gradually
- Maintain good performance
- Enable future features like:
  - "Find all videos teaching 'Konjunktiv'"
  - "Show my learning progress by word difficulty"
  - "Recommend videos based on vocabulary gaps" 