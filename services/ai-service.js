const aiConfig = require('../config/ai-config');
const pool = require('../config/database');

// Split long text into chunks for processing
function splitTextIntoChunks(text, maxChunkSize = 3000) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}

// Generate questions from transcript
async function generateQuestionsFromTranscript(transcript, options = {}) {
    const {
        questionCount = 5,
        questionTypes = ['comprehension', 'vocabulary', 'grammar'],
        difficulty = 'intermediate'
    } = options;
    
    // For long transcripts, split into chunks
    const chunks = splitTextIntoChunks(transcript, 2000);
    const allQuestions = [];
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkQuestionCount = Math.ceil(questionCount / chunks.length);
        
        const prompt = `Based on this German transcript excerpt, generate ${chunkQuestionCount} multiple-choice questions for language learners.

Transcript excerpt:
"${chunk}"

Requirements:
1. Question types to include: ${questionTypes.join(', ')}
2. Difficulty level: ${difficulty}
3. Each question must have exactly 4 options labeled A, B, C, D
4. Questions should be in German
5. Format as JSON array with this exact structure:
[{
    "question": "Question text in German",
    "options": [
        {"label": "A", "text": "Option A text"},
        {"label": "B", "text": "Option B text"},
        {"label": "C", "text": "Option C text"},
        {"label": "D", "text": "Option D text"}
    ],
    "correct_answer": "B",
    "type": "comprehension",
    "difficulty": "medium",
    "explanation": "Brief explanation why this answer is correct"
}]

Generate diverse, educational questions that help students learn German.`;

        try {
            const response = await aiConfig.askAI(prompt, {
                temperature: 0.7,
                maxTokens: 1500,
                systemPrompt: 'You are an expert German language teacher creating multiple-choice questions. Always return valid JSON.'
            });
            
            // Parse the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const questions = JSON.parse(jsonMatch[0]);
                allQuestions.push(...questions.map(q => ({
                    ...q,
                    chunkIndex: i,
                    chunkTotal: chunks.length
                })));
            }
        } catch (error) {
            console.error(`Error generating questions for chunk ${i}:`, error);
        }
    }
    
    return allQuestions;
}

// Improve auto-generated subtitles
async function improveSubtitles(subtitles, options = {}) {
    const {
        preserveTiming = true,
        targetLanguage = 'de',
        context = ''
    } = options;
    
    const prompt = `Please improve these auto-generated ${targetLanguage === 'de' ? 'German' : targetLanguage} subtitles to create perfect learning text.

Original subtitles:
"${subtitles}"

${context ? `Video context: ${context}` : ''}

Requirements:
1. Correct any grammar errors
2. Add proper punctuation
3. Fix any transcription errors
4. Ensure sentences are complete and well-formed
5. Maintain the natural flow and meaning
6. Keep the content length similar (for timing)
7. Make it suitable for language learners

Return only the improved text, maintaining paragraph breaks where appropriate.`;

    try {
        const improvedText = await aiConfig.askAI(prompt, {
            temperature: 0.3, // Lower temperature for more consistent corrections
            maxTokens: Math.min(subtitles.length * 2, 4000),
            systemPrompt: 'You are an expert language teacher and transcript editor. Your goal is to create perfect learning material from imperfect transcripts.'
        });
        
        return improvedText.trim();
    } catch (error) {
        console.error('Error improving subtitles:', error);
        throw error;
    }
}

// Generate summary from transcript chunks
async function generateSummary(transcript, options = {}) {
    const {
        maxLength = 500,
        style = 'educational',
        includeKeyPoints = true
    } = options;
    
    // For very long transcripts, process in chunks first
    const chunks = splitTextIntoChunks(transcript, 3000);
    
    if (chunks.length > 1) {
        // Generate summaries for each chunk
        const chunkSummaries = [];
        
        for (const chunk of chunks) {
            const chunkSummary = await aiConfig.askAI(
                `Summarize this German text excerpt in 2-3 sentences: "${chunk}"`,
                {
                    temperature: 0.5,
                    maxTokens: 200
                }
            );
            chunkSummaries.push(chunkSummary);
        }
        
        // Then create overall summary from chunk summaries
        transcript = chunkSummaries.join('\n\n');
    }
    
    const prompt = `Create an ${style} summary of this German content.

Content:
"${transcript}"

Requirements:
1. Maximum ${maxLength} words
2. ${style === 'educational' ? 'Focus on key learning points' : 'General overview'}
3. Write in clear, simple German suitable for learners
${includeKeyPoints ? '4. Include a "Key Points" section at the end' : ''}

Format the summary with clear paragraphs.`;

    try {
        const summary = await aiConfig.askAI(prompt, {
            temperature: 0.5,
            maxTokens: Math.min(maxLength * 2, 1500),
            systemPrompt: 'You are creating educational summaries for German language learners.'
        });
        
        return summary.trim();
    } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}

// Process video for AI enhancement
async function processVideoWithAI(videoId) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get video details
        const videoResult = await client.query(`
            SELECT video_id, title, pure_subtitle, sub_manual, summary, language_target
            FROM our_videos
            WHERE video_id = $1
        `, [videoId]);
        
        if (videoResult.rows.length === 0) {
            throw new Error('Video not found');
        }
        
        const video = videoResult.rows[0];
        const config = aiConfig.getActiveConfig();
        const processed = [];
        
        // Check if we need to generate content for auto-subtitled videos
        let contentToUse = video.pure_subtitle;
        if (video.sub_manual !== 2 && video.pure_subtitle) {
            console.log(`Generating clean content for video ${videoId}...`);
            const cleanContent = await improveSubtitles(video.pure_subtitle, {
                targetLanguage: video.language_target || 'de',
                context: video.title
            });
            
            // Store in AI content table
            await client.query(`
                INSERT INTO our_video_ai_content (video_id, ai_content, ai_model)
                VALUES ($1, $2, $3)
                ON CONFLICT (video_id) 
                DO UPDATE SET 
                    ai_content = EXCLUDED.ai_content,
                    ai_model = EXCLUDED.ai_model,
                    updated_at = NOW()
            `, [videoId, cleanContent, `${config.provider}:${config.model}`]);
            
            contentToUse = cleanContent;
            processed.push('ai_content');
        }
        
        // Generate or update summary
        if (contentToUse && (!video.summary || video.summary.length < 100)) {
            console.log(`Generating summary for video ${videoId}...`);
            const aiSummary = await generateSummary(contentToUse);
            
            // Store in AI content table
            await client.query(`
                INSERT INTO our_video_ai_content (video_id, ai_summary, ai_model)
                VALUES ($1, $2, $3)
                ON CONFLICT (video_id) 
                DO UPDATE SET 
                    ai_summary = EXCLUDED.ai_summary,
                    ai_model = EXCLUDED.ai_model,
                    updated_at = NOW()
            `, [videoId, aiSummary, `${config.provider}:${config.model}`]);
            
            processed.push('ai_summary');
        }
        
        // Generate questions
        if (contentToUse) {
            console.log(`Generating questions for video ${videoId}...`);
            
            // Delete existing questions for this video
            await client.query('DELETE FROM our_video_questions WHERE video_id = $1', [videoId]);
            
            const questions = await generateQuestionsFromTranscript(contentToUse, {
                questionCount: Math.min(10, Math.ceil(contentToUse.length / 500)),
                difficulty: 'mixed'
            });
            
            // Insert questions into database
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                await client.query(`
                    INSERT INTO our_video_questions 
                    (video_id, question, options, correct_answer, question_type, 
                     difficulty, explanation, question_index, ai_model)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    videoId,
                    q.question,
                    JSON.stringify(q.options),
                    q.correct_answer,
                    q.type || 'comprehension',
                    q.difficulty || 'medium',
                    q.explanation || null,
                    i,
                    `${config.provider}:${config.model}`
                ]);
            }
            
            processed.push(`${questions.length} questions`);
        }
        
        await client.query('COMMIT');
        
        return {
            videoId,
            processed,
            questionsGenerated: processed.includes('questions') ? questions.length : 0
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    generateQuestionsFromTranscript,
    improveSubtitles,
    generateSummary,
    processVideoWithAI,
    splitTextIntoChunks
};