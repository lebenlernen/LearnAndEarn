-- Create translation cache table
CREATE TABLE IF NOT EXISTS our_translation_cache (
    id SERIAL PRIMARY KEY,
    source_text VARCHAR(255) NOT NULL,
    source_language VARCHAR(50) NOT NULL,
    target_language VARCHAR(50) NOT NULL,
    translated_text VARCHAR(255) NOT NULL,
    lemma VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    use_count INTEGER DEFAULT 1,
    UNIQUE(source_text, source_language, target_language)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup 
ON our_translation_cache(source_text, source_language, target_language);

CREATE INDEX IF NOT EXISTS idx_translation_cache_lemma 
ON our_translation_cache(lemma, source_language, target_language);

-- Create a function to update last_used and use_count
CREATE OR REPLACE FUNCTION update_translation_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used = CURRENT_TIMESTAMP;
    NEW.use_count = OLD.use_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating usage stats
DROP TRIGGER IF EXISTS update_translation_usage_trigger ON our_translation_cache;
CREATE TRIGGER update_translation_usage_trigger
BEFORE UPDATE ON our_translation_cache
FOR EACH ROW
WHEN (OLD.translated_text IS NOT DISTINCT FROM NEW.translated_text)
EXECUTE FUNCTION update_translation_usage();