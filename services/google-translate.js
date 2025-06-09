const { Translate } = require('@google-cloud/translate').v2;
const path = require('path');

// Google Cloud Translate service
class GoogleTranslateService {
    constructor() {
        // Path to service account credentials
        const credentialsPath = path.join(__dirname, '../../mark_learnandearn/mnt/extra-addons/_our_seewald_youtube/models/Service_Creds.json');
        
        // Initialize Google Translate client
        this.translate = new Translate({
            keyFilename: credentialsPath,
            projectId: 'odoogdrive-427107'
        });
        
        this.cache = new Map(); // Simple in-memory cache
        this.db = null; // Will be set by the route
    }

    setDatabase(db) {
        this.db = db;
    }

    // Normalize language names
    normalizeLanguage(language) {
        const normalizationMap = {
            'Englisch': 'English',
            'Deutsch': 'German',
            'Spanisch': 'Spanish',
            'Französisch': 'French',
            'Italienisch': 'Italian',
            'Portugiesisch': 'Portuguese',
            'Russisch': 'Russian',
            'Chinesisch': 'Chinese',
            'Japanisch': 'Japanese',
            'Türkisch': 'Turkish',
            'Arabisch': 'Arabic',
            'Polnisch': 'Polish',
            'Niederländisch': 'Dutch',
            'Schwedisch': 'Swedish',
            'Koreanisch': 'Korean',
            'Vietnamesisch': 'Vietnamese'
        };
        
        return normalizationMap[language] || language;
    }

    // Get language code for Google Translate
    getLanguageCode(language) {
        const languageMap = {
            'English': 'en',
            'Englisch': 'en',
            'German': 'de',
            'Deutsch': 'de',
            'Spanish': 'es',
            'Spanisch': 'es',
            'French': 'fr',
            'Französisch': 'fr',
            'Italian': 'it',
            'Italienisch': 'it',
            'Portuguese': 'pt',
            'Portugiesisch': 'pt',
            'Russian': 'ru',
            'Russisch': 'ru',
            'Chinese': 'zh',
            'Chinesisch': 'zh',
            'Japanese': 'ja',
            'Japanisch': 'ja',
            'Turkish': 'tr',
            'Türkisch': 'tr',
            'Arabic': 'ar',
            'Arabisch': 'ar',
            'Polish': 'pl',
            'Polnisch': 'pl',
            'Dutch': 'nl',
            'Niederländisch': 'nl',
            'Swedish': 'sv',
            'Schwedisch': 'sv',
            'Korean': 'ko',
            'Koreanisch': 'ko',
            'Vietnamese': 'vi',
            'Vietnamesisch': 'vi'
        };
        
        return languageMap[language] || language.toLowerCase().substring(0, 2);
    }

    async translateText(text, targetLanguage, sourceLanguage = 'de') {
        try {
            // Check cache first
            const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const targetCode = this.getLanguageCode(targetLanguage);
            const sourceCode = this.getLanguageCode(sourceLanguage);
            
            // Skip if same language
            if (sourceCode === targetCode) {
                return text;
            }

            // Use Google Translate API
            const [translation] = await this.translate.translate(text, {
                from: sourceCode,
                to: targetCode
            });

            // Cache the result
            this.cache.set(cacheKey, translation);
            
            return translation;
        } catch (error) {
            console.error('Google Translate error:', error);
            return null;
        }
    }

    async translateBatch(texts, targetLanguage, sourceLanguage = 'de') {
        try {
            const targetCode = this.getLanguageCode(targetLanguage);
            const sourceCode = this.getLanguageCode(sourceLanguage);
            
            // Skip if same language
            if (sourceCode === targetCode) {
                return texts;
            }

            // Translate each word individually to avoid mixed results
            const results = [];
            
            for (const text of texts) {
                const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
                
                // Check cache first
                if (this.cache.has(cacheKey)) {
                    results.push(this.cache.get(cacheKey));
                    continue;
                }
                
                try {
                    // Translate individual word
                    const [translation] = await this.translate.translate(text, {
                        from: sourceCode,
                        to: targetCode
                    });
                    
                    // Cache the result
                    this.cache.set(cacheKey, translation);
                    results.push(translation);
                } catch (err) {
                    console.error(`Failed to translate "${text}":`, err);
                    results.push(text); // Use original if translation fails
                }
            }

            return results;
        } catch (error) {
            console.error('Google Translate batch error:', error);
            // Return original texts on error
            return texts;
        }
    }

    // Translate vocabulary with lemma storage
    async translateVocabularyWithLemmas(vocabulary, targetLanguage, sourceLanguage = 'de') {
        try {
            const targetCode = this.getLanguageCode(targetLanguage);
            const sourceCode = this.getLanguageCode(sourceLanguage);
            
            // Skip if same language
            if (sourceCode === targetCode) {
                return vocabulary;
            }

            const results = [];
            
            for (const word of vocabulary) {
                // First check if we have a stored translation for this lemma
                let translation = null;
                
                if (this.db) {
                    try {
                        const storedTranslation = await this.db.query(
                            `SELECT translation FROM our_lemma_translations 
                             WHERE lemma = $1 AND source_language = $2 AND target_language = $3 
                             AND (pos = $4 OR pos IS NULL)
                             ORDER BY pos NULLS LAST
                             LIMIT 1`,
                            [word.lemma || word.original_word, sourceCode, targetCode, word.pos]
                        );
                        
                        if (storedTranslation.rows.length > 0) {
                            translation = storedTranslation.rows[0].translation;
                            console.log(`Found stored translation for lemma "${word.lemma}": ${translation}`);
                        }
                    } catch (err) {
                        console.error('Error checking stored translations:', err);
                    }
                }
                
                // If no stored translation, use Google Translate
                if (!translation) {
                    try {
                        // Translate the lemma (base form) instead of the inflected form
                        const textToTranslate = word.lemma || word.original_word;
                        const [googleTranslation] = await this.translate.translate(textToTranslate, {
                            from: sourceCode,
                            to: targetCode
                        });
                        
                        translation = googleTranslation;
                        
                        // Store the translation for future use
                        if (this.db && word.lemma) {
                            try {
                                await this.db.query(
                                    `INSERT INTO our_lemma_translations 
                                     (lemma, source_language, target_language, translation, pos)
                                     VALUES ($1, $2, $3, $4, $5)
                                     ON CONFLICT (lemma, source_language, target_language, pos) 
                                     DO UPDATE SET translation = $4, updated_at = CURRENT_TIMESTAMP`,
                                    [word.lemma, sourceCode, targetCode, translation, word.pos]
                                );
                                console.log(`Stored new translation for lemma "${word.lemma}": ${translation}`);
                            } catch (err) {
                                console.error('Error storing translation:', err);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to translate "${word.original_word}":`, err);
                        translation = word.original_word; // Use original if translation fails
                    }
                }
                
                results.push({
                    ...word,
                    translation: translation
                });
            }

            return results;
        } catch (error) {
            console.error('Google Translate vocabulary error:', error);
            // Return original vocabulary on error
            return vocabulary;
        }
    }
}

module.exports = new GoogleTranslateService();