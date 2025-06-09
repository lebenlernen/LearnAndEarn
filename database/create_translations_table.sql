-- Create table for storing word translations
CREATE TABLE IF NOT EXISTS our_word_translations (
    id SERIAL PRIMARY KEY,
    german_word VARCHAR(255) NOT NULL,
    german_lemma VARCHAR(255),
    language VARCHAR(100) NOT NULL,
    translation VARCHAR(255) NOT NULL,
    part_of_speech VARCHAR(50),
    verified BOOLEAN DEFAULT FALSE,
    source VARCHAR(100) DEFAULT 'manual', -- manual, api, user_contributed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    
    CONSTRAINT fk_created_by
        FOREIGN KEY(created_by) 
        REFERENCES our_users(id) 
        ON DELETE SET NULL,
        
    CONSTRAINT unique_word_language
        UNIQUE(german_word, language)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_translations_german_word ON our_word_translations(german_word);
CREATE INDEX IF NOT EXISTS idx_translations_german_lemma ON our_word_translations(german_lemma);
CREATE INDEX IF NOT EXISTS idx_translations_language ON our_word_translations(language);
CREATE INDEX IF NOT EXISTS idx_translations_verified ON our_word_translations(verified);

-- Insert some common translations for testing
INSERT INTO our_word_translations (german_word, german_lemma, language, translation, part_of_speech, verified, source)
VALUES 
    ('Hund', 'Hund', 'English', 'dog', 'NOUN', true, 'manual'),
    ('Katze', 'Katze', 'English', 'cat', 'NOUN', true, 'manual'),
    ('Haus', 'Haus', 'English', 'house', 'NOUN', true, 'manual'),
    ('gehen', 'gehen', 'English', 'to go', 'VERB', true, 'manual'),
    ('gut', 'gut', 'English', 'good', 'ADJ', true, 'manual'),
    ('Hund', 'Hund', 'Spanish', 'perro', 'NOUN', true, 'manual'),
    ('Katze', 'Katze', 'Spanish', 'gato', 'NOUN', true, 'manual'),
    ('Haus', 'Haus', 'Spanish', 'casa', 'NOUN', true, 'manual'),
    ('Hund', 'Hund', 'French', 'chien', 'NOUN', true, 'manual'),
    ('Katze', 'Katze', 'French', 'chat', 'NOUN', true, 'manual')
ON CONFLICT (german_word, language) DO NOTHING;