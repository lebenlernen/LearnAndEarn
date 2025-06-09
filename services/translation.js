const axios = require('axios');

// Translation service using database first, then API fallback
class TranslationService {
    constructor() {
        // You can use a public instance or host your own
        // Public instance: https://libretranslate.de
        // Or use Google Translate API with API key
        this.apiUrl = process.env.TRANSLATE_API_URL || 'https://libretranslate.de/translate';
        this.apiKey = process.env.TRANSLATE_API_KEY || '';
        this.db = null; // Will be set by the route
    }
    
    // Set database connection
    setDatabase(db) {
        this.db = db;
    }

    // Language code mapping
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
            'Koreanisch': 'ko'
        };
        
        return languageMap[language] || language.toLowerCase().substring(0, 2);
    }
    
    // Normalize language name to English
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
            'Koreanisch': 'Korean'
        };
        
        return normalizationMap[language] || language;
    }

    async translate(text, sourceLang, targetLang) {
        try {
            const sourceCode = this.getLanguageCode(sourceLang);
            const targetCode = this.getLanguageCode(targetLang);
            
            // If same language, return original text
            if (sourceCode === targetCode) {
                return text;
            }

            // First, check database for existing translation
            if (this.db) {
                try {
                    const query = `
                        SELECT translation 
                        FROM our_word_translations 
                        WHERE german_word = $1 AND language = $2
                        LIMIT 1
                    `;
                    const result = await this.db.query(query, [text, targetLang]);
                    
                    if (result.rows.length > 0) {
                        return result.rows[0].translation;
                    }
                } catch (dbError) {
                    console.error('Database translation lookup failed:', dbError);
                }
            }

            // For development/testing, use a simple mock translation
            // In production, use actual translation API
            if (process.env.NODE_ENV === 'development' && !this.apiKey) {
                return this.mockTranslate(text, sourceCode, targetCode);
            }

            // Actual API call
            const response = await axios.post(this.apiUrl, {
                q: text,
                source: sourceCode,
                target: targetCode,
                api_key: this.apiKey
            });

            // Save successful translation to database
            if (this.db && response.data.translatedText) {
                try {
                    const insertQuery = `
                        INSERT INTO our_word_translations 
                        (german_word, language, translation, source)
                        VALUES ($1, $2, $3, 'api')
                        ON CONFLICT (german_word, language) DO NOTHING
                    `;
                    await this.db.query(insertQuery, [text, targetLang, response.data.translatedText]);
                } catch (insertError) {
                    console.error('Failed to save translation:', insertError);
                }
            }

            return response.data.translatedText;
        } catch (error) {
            console.error('Translation error:', error.message);
            // Return null to indicate no translation available
            return null;
        }
    }

    // Mock translation for development
    mockTranslate(text, sourceLang, targetLang) {
        const mockTranslations = {
            'de_en': {
                'Hund': 'dog',
                'Katze': 'cat',
                'Haus': 'house',
                'Auto': 'car',
                'Schule': 'school',
                'Arbeit': 'work',
                'essen': 'eat',
                'trinken': 'drink',
                'gehen': 'go',
                'kommen': 'come',
                'gut': 'good',
                'schlecht': 'bad',
                'groß': 'big',
                'klein': 'small'
            },
            'en_de': {
                'dog': 'Hund',
                'cat': 'Katze',
                'house': 'Haus',
                'car': 'Auto',
                'school': 'Schule',
                'work': 'Arbeit',
                'eat': 'essen',
                'drink': 'trinken',
                'go': 'gehen',
                'come': 'kommen',
                'good': 'gut',
                'bad': 'schlecht',
                'big': 'groß',
                'small': 'klein'
            }
        };

        const key = `${sourceLang}_${targetLang}`;
        const translations = mockTranslations[key] || {};
        
        // Try to find exact match
        const lowerText = text.toLowerCase();
        if (translations[lowerText]) {
            return translations[lowerText];
        }

        // For development, return a marked translation
        return `[${targetLang}] ${text}`;
    }

    // Translate multiple texts at once
    async translateBatch(texts, sourceLang, targetLang) {
        const promises = texts.map(text => this.translate(text, sourceLang, targetLang));
        return Promise.all(promises);
    }
}

module.exports = new TranslationService();