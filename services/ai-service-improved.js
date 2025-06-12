const aiConfig = require('../config/ai-config');
const pool = require('../config/database');

// Split long text into chunks with overlap for context
function splitTextIntoChunks(text, maxChunkSize = 2000, overlap = 200) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    let chunkStart = 0;
    
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
            // Store chunk with metadata
            chunks.push({
                text: currentChunk.trim(),
                startIndex: chunkStart,
                endIndex: chunkStart + currentChunk.length,
                sentenceIndices: [chunkStart, i]
            });
            
            // Start new chunk with overlap
            currentChunk = '';
            chunkStart = chunkStart + currentChunk.length - overlap;
            
            // Add last few sentences from previous chunk for context
            let overlapText = '';
            for (let j = Math.max(0, i - 2); j < i; j++) {
                overlapText += sentences[j];
            }
            currentChunk = overlapText + sentence;
        } else {
            currentChunk += sentence;
        }
    }
    
    // Add final chunk
    if (currentChunk) {
        chunks.push({
            text: currentChunk.trim(),
            startIndex: chunkStart,
            endIndex: text.length,
            sentenceIndices: [chunkStart, sentences.length - 1]
        });
    }
    
    return chunks;
}

// Get chunks that need more questions
async function getChunksNeedingQuestions(videoId, totalChunks) {
    const client = await pool.connect();
    
    try {
        // Get existing questions with chunk info
        const result = await client.query(`
            SELECT 
                chunk_index,
                COUNT(*) as question_count
            FROM our_video_questions
            WHERE video_id = $1 AND chunk_index IS NOT NULL
            GROUP BY chunk_index
            ORDER BY chunk_index
        `, [videoId]);
        
        // Create a map of chunk coverage
        const chunkCoverage = new Map();
        for (let i = 0; i < totalChunks; i++) {
            chunkCoverage.set(i, 0);
        }
        
        // Update with actual counts
        result.rows.forEach(row => {
            chunkCoverage.set(row.chunk_index, parseInt(row.question_count));
        });
        
        // Find chunks that need questions (prioritize chunks with fewer questions)
        const chunksNeeded = [];
        const targetQuestionsPerChunk = Math.ceil(15 / totalChunks);
        
        for (const [chunkIndex, count] of chunkCoverage) {
            if (count < targetQuestionsPerChunk) {
                chunksNeeded.push({
                    index: chunkIndex,
                    currentCount: count,
                    needed: targetQuestionsPerChunk - count
                });
            }
        }
        
        // Sort by least questions first
        chunksNeeded.sort((a, b) => a.currentCount - b.currentCount);
        
        return chunksNeeded;
        
    } finally {
        client.release();
    }
}

// Get existing questions to avoid duplicates
async function getExistingQuestions(videoId) {
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT question, chunk_index
            FROM our_video_questions
            WHERE video_id = $1
            ORDER BY question_index
        `, [videoId]);
        
        return result.rows;
        
    } finally {
        client.release();
    }
}

// Generate questions from specific chunks
async function generateQuestionsFromChunks(transcript, options = {}) {
    const {
        questionCount = 5,
        questionTypes = ['comprehension', 'vocabulary', 'grammar'],
        difficulty = 'intermediate',
        targetChunks = null, // Array of chunk indices to generate from
        existingQuestions = [],
        videoId = null
    } = options;
    
    // Split into chunks
    const chunks = splitTextIntoChunks(transcript, 2000);
    
    // If no target chunks specified, get chunks needing questions
    let chunksToProcess = targetChunks;
    if (!chunksToProcess && videoId) {
        const chunksNeeded = await getChunksNeedingQuestions(videoId, chunks.length);
        chunksToProcess = chunksNeeded.slice(0, Math.ceil(questionCount / 2)).map(c => c.index);
    }
    
    // If still no chunks, use first few
    if (!chunksToProcess || chunksToProcess.length === 0) {
        chunksToProcess = Array.from({length: Math.min(3, chunks.length)}, (_, i) => i);
    }
    
    const allQuestions = [];
    const questionsPerChunk = Math.ceil(questionCount / chunksToProcess.length);
    
    // Format existing questions for context
    const existingQuestionsText = existingQuestions.length > 0 
        ? `\n\nExisting questions to avoid duplicating:\n${existingQuestions.map(q => `- ${q.question}`).join('\n')}`
        : '';
    
    for (const chunkIndex of chunksToProcess) {
        if (chunkIndex >= chunks.length) continue;
        
        const chunk = chunks[chunkIndex];
        const chunkContext = {
            position: `Part ${chunkIndex + 1} of ${chunks.length}`,
            isBeginning: chunkIndex === 0,
            isEnd: chunkIndex === chunks.length - 1
        };
        
        const prompt = `Based on this German transcript excerpt (${chunkContext.position}), generate ${questionsPerChunk} multiple-choice questions for language learners.

Transcript excerpt:
"${chunk.text}"

Context: This is ${chunkContext.isBeginning ? 'the beginning' : chunkContext.isEnd ? 'the end' : 'the middle'} of the transcript.
${existingQuestionsText}

Requirements:
1. Question types to include: ${questionTypes.join(', ')}
2. Difficulty level: ${difficulty}
3. Each question must have exactly 4 options labeled A, B, C, D
4. Questions should be in German
5. Questions must be about THIS specific excerpt, not general knowledge
6. Avoid questions similar to existing ones
7. Format as JSON array with this exact structure:
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
                    chunk_index: chunkIndex,
                    chunk_total: chunks.length,
                    chunk_position: chunk.startIndex,
                    chunk_text_preview: chunk.text.substring(0, 100) + '...'
                })));
            }
        } catch (error) {
            console.error(`Error generating questions for chunk ${chunkIndex}:`, error);
        }
    }
    
    return allQuestions;
}

// Improved background question generation
async function generateQuestionsIntelligently(videoId, existingCount, targetCount = 15) {
    const client = await pool.connect();
    
    try {
        // Get video content
        const videoResult = await client.query(`
            SELECT v.pure_subtitle, v.title, v.language_target,
                   ac.ai_content
            FROM our_videos v
            LEFT JOIN our_video_ai_content ac ON v.video_id = ac.video_id
            WHERE v.video_id = $1
        `, [videoId]);
        
        if (videoResult.rows.length === 0) {
            throw new Error('Video not found');
        }
        
        const video = videoResult.rows[0];
        const content = video.ai_content || video.pure_subtitle;
        
        if (!content) {
            throw new Error('No content available');
        }
        
        // Get existing questions
        const existingQuestions = await getExistingQuestions(videoId);
        
        // Calculate how many questions to generate
        const questionsToGenerate = Math.min(5, targetCount - existingCount);
        
        // Generate questions from underrepresented chunks
        const newQuestions = await generateQuestionsFromChunks(content, {
            questionCount: questionsToGenerate,
            questionTypes: ['comprehension', 'vocabulary', 'grammar'],
            difficulty: 'intermediate',
            existingQuestions: existingQuestions,
            videoId: videoId
        });
        
        return newQuestions;
        
    } finally {
        client.release();
    }
}

module.exports = {
    splitTextIntoChunks,
    getChunksNeedingQuestions,
    getExistingQuestions,
    generateQuestionsFromChunks,
    generateQuestionsIntelligently,
    // Keep old function for compatibility
    generateQuestionsFromTranscript: generateQuestionsFromChunks
};