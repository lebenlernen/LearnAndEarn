-- Create video sentences table
CREATE TABLE IF NOT EXISTS our_video_sentences (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    sentence TEXT NOT NULL,
    sentence_index INTEGER,
    word_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_id, sentence)
);

-- Create sentence translations table
CREATE TABLE IF NOT EXISTS our_sentence_translations (
    id SERIAL PRIMARY KEY,
    sentence_id INTEGER REFERENCES our_video_sentences(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    translation TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sentence_id, language)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_sentences_video_id 
ON our_video_sentences(video_id);

CREATE INDEX IF NOT EXISTS idx_sentence_translations_sentence_id 
ON our_sentence_translations(sentence_id);

CREATE INDEX IF NOT EXISTS idx_sentence_translations_language 
ON our_sentence_translations(language);