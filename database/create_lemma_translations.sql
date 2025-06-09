-- Create permanent lemma translations table
CREATE TABLE IF NOT EXISTS our_lemma_translations (
    id SERIAL PRIMARY KEY,
    lemma VARCHAR(255) NOT NULL,
    source_language VARCHAR(50) NOT NULL DEFAULT 'de',
    target_language VARCHAR(50) NOT NULL,
    translation VARCHAR(255) NOT NULL,
    pos VARCHAR(50), -- Part of speech (NOUN, VERB, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lemma, source_language, target_language, pos)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lemma_translations_lookup 
ON our_lemma_translations(lemma, target_language);

CREATE INDEX IF NOT EXISTS idx_lemma_translations_pos 
ON our_lemma_translations(lemma, pos, target_language);

-- Add some common German-English translations as examples
INSERT INTO our_lemma_translations (lemma, source_language, target_language, translation, pos) 
VALUES 
    ('gehen', 'de', 'en', 'go', 'VERB'),
    ('sein', 'de', 'en', 'be', 'VERB'),
    ('haben', 'de', 'en', 'have', 'VERB'),
    ('machen', 'de', 'en', 'make/do', 'VERB'),
    ('kommen', 'de', 'en', 'come', 'VERB'),
    ('sagen', 'de', 'en', 'say', 'VERB'),
    ('geben', 'de', 'en', 'give', 'VERB'),
    ('sehen', 'de', 'en', 'see', 'VERB'),
    ('wissen', 'de', 'en', 'know', 'VERB'),
    ('denken', 'de', 'en', 'think', 'VERB')
ON CONFLICT (lemma, source_language, target_language, pos) DO NOTHING;