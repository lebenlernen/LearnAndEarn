const OpenAI = require('openai');
const { getActiveConfig } = require('../config/ai-config');

class AISummaryService {
    constructor() {
        this.modelConfig = null;
        this.client = null;
    }

    async initialize() {
        this.modelConfig = getActiveConfig();
        if (!this.modelConfig) {
            throw new Error('AI configuration not found');
        }

        if (this.modelConfig.provider === 'OPENAI') {
            this.client = new OpenAI({
                apiKey: this.modelConfig.apiKey,
            });
        } else if (this.modelConfig.provider === 'DEEPSEEK') {
            this.client = new OpenAI({
                apiKey: this.modelConfig.apiKey,
                baseURL: this.modelConfig.baseURL + '/v1',
            });
        }
    }

    /**
     * Generate educational summaries from video transcript
     */
    async generateSummaries(videoTitle, videoTranscript, language = 'de') {
        if (!this.client) {
            await this.initialize();
        }

        const languageInstructions = {
            'de': {
                level: 'B1-B2',
                style: 'Verwenden Sie klare, einfache Sätze. Erklären Sie Fachbegriffe.',
                cultural: 'Fügen Sie kulturelle Kontexte hinzu, wenn relevant.'
            },
            'en': {
                level: 'B1-B2',
                style: 'Use clear, simple sentences. Explain technical terms.',
                cultural: 'Add cultural context where relevant.'
            }
        };

        const langConfig = languageInstructions[language] || languageInstructions['de'];

        const prompt = `
You are an expert language teacher creating educational content from a video transcript.

Video Title: "${videoTitle}"
Target Language: ${language.toUpperCase()}
Language Level: ${langConfig.level}

IMPORTANT: Write ALL content in ${language === 'de' ? 'German (Deutsch)' : language.toUpperCase()}. Do NOT write in English.

Video Transcript:
${videoTranscript}

Create educational content IN ${language === 'de' ? 'GERMAN' : language.toUpperCase()} with these requirements:

1. SHORT SUMMARY (100-200 words):
   - Overview of the main topic
   - Key learning points
   - Why this content is interesting/useful
   - Written at ${langConfig.level} level

2. LONG EDUCATIONAL TEXT (500-1000 words):
   - Rewrite the video content as a coherent learning text
   - Structure in clear paragraphs (3-5 sentences each)
   - Each paragraph should be one complete thought
   - ${langConfig.style}
   - Include examples from the video
   - ${langConfig.cultural}
   - Make it engaging and educational
   - End with a clear conclusion

3. SENTENCE STRUCTURE:
   - Keep sentences between 10-20 words when possible
   - Use natural speaking rhythm
   - Avoid complex subordinate clauses
   - One main idea per sentence

Format your response as JSON:
{
    "shortSummary": "...",
    "longSummary": "...",
    "sentenceCount": number
}
`;

        try {
            const completion = await this.client.chat.completions.create({
                model: this.modelConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert ${language === 'de' ? 'German' : language} language teacher creating educational content in ${language === 'de' ? 'German (Deutsch)' : language.toUpperCase()}. Always respond with valid JSON. NEVER write content in English unless explicitly asked.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000,
                response_format: { type: "json_object" }
            });

            const response = JSON.parse(completion.choices[0].message.content);
            
            // Parse long summary into sentences
            const sentences = this.parseSentences(response.longSummary);
            
            return {
                shortSummary: response.shortSummary,
                longSummary: response.longSummary,
                sentences: sentences,
                model: this.modelConfig.model,
                promptVersion: '1.0'
            };

        } catch (error) {
            console.error('Error generating summaries:', error);
            throw error;
        }
    }

    /**
     * Parse text into sentences for practice
     */
    parseSentences(text) {
        // Split by sentence-ending punctuation
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        const matches = text.match(sentenceRegex) || [];
        
        return matches
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map((sentence, index) => ({
                text: sentence,
                index: index,
                wordCount: sentence.split(/\s+/).length
            }));
    }

    /**
     * Regenerate summaries with different parameters
     */
    async regenerateSummaries(videoId, options = {}) {
        const { temperature = 0.8, model = null } = options;
        
        if (model && model !== this.modelConfig.model) {
            // Temporarily switch model
            const originalModel = this.modelConfig.model;
            this.modelConfig.model = model;
            
            try {
                const result = await this.generateSummaries(
                    options.title,
                    options.transcript,
                    options.language
                );
                return result;
            } finally {
                this.modelConfig.model = originalModel;
            }
        }
        
        return this.generateSummaries(
            options.title,
            options.transcript,
            options.language
        );
    }
}

module.exports = new AISummaryService();