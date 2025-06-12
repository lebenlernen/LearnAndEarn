-- Create table for storing SpaCy token analysis per sentence
-- This allows context-aware word analysis for Lückentexte exercises

CREATE TABLE IF NOT EXISTS our_video_sentence_tokens (
    id SERIAL PRIMARY KEY,
    sentence_id INTEGER NOT NULL,
    token_index INTEGER NOT NULL,  -- Position in sentence (0-based)
    text VARCHAR(255) NOT NULL,    -- Original text (e.g., "Spielen", "spielen")
    text_lower VARCHAR(255),       -- Lowercase version
    lemma VARCHAR(255),            -- Base form (e.g., "spielen")
    pos VARCHAR(50),               -- Part of speech (NOUN, VERB, ADJ, etc.)
    tag VARCHAR(50),               -- Detailed tag (NN, VVFIN, etc.)
    dep VARCHAR(50),               -- Dependency relation
    is_stop BOOLEAN DEFAULT FALSE,
    is_punct BOOLEAN DEFAULT FALSE,
    is_space BOOLEAN DEFAULT FALSE,
    
    -- Foreign key to sentences table
    CONSTRAINT fk_sentence 
        FOREIGN KEY(sentence_id) 
        REFERENCES our_video_sentences(id) 
        ON DELETE CASCADE,
    
    -- Ensure unique token per sentence position
    CONSTRAINT unique_sentence_token 
        UNIQUE(sentence_id, token_index)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sentence_tokens_sentence_id ON our_video_sentence_tokens(sentence_id);
CREATE INDEX IF NOT EXISTS idx_sentence_tokens_pos ON our_video_sentence_tokens(pos);
CREATE INDEX IF NOT EXISTS idx_sentence_tokens_lemma ON our_video_sentence_tokens(lemma);

-- Example query to find all sentences with nominalized verbs (das/Das + capitalized verb)
-- SELECT DISTINCT s.sentence, st1.text as article, st2.text as noun
-- FROM our_video_sentences s
-- JOIN our_video_sentence_tokens st1 ON s.id = st1.sentence_id
-- JOIN our_video_sentence_tokens st2 ON s.id = st2.sentence_id
-- WHERE st1.text_lower IN ('das', 'dem', 'des')
-- AND st2.token_index = st1.token_index + 1
-- AND st2.pos = 'NOUN'
-- AND st2.lemma IN (
--     SELECT DISTINCT lemma FROM our_videos_base_words WHERE pos = 'VERB'
-- );