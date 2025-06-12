const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const pool = require('../config/database');
const aiServiceImproved = require('../services/ai-service-improved');

// Check if user can generate questions
async function canGenerateQuestions(userId, userRoles) {
    const client = await pool.connect();
    
    try {
        const configResult = await client.query(`
            SELECT config_value 
            FROM our_system_config 
            WHERE config_key = 'question_generation_allowed'
        `);
        
        if (configResult.rows.length === 0) {
            return false;
        }
        
        const allowedRoles = JSON.parse(configResult.rows[0].config_value);
        return userRoles.some(role => allowedRoles.includes(role));
    } catch (error) {
        console.error('Error checking question generation permissions:', error);
        return false;
    } finally {
        client.release();
    }
}

// Get questions for a video with chunk distribution info
router.get('/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const client = await pool.connect();
    
    try {
        // First, determine if we're dealing with numeric ID or YouTube video_id
        let actualVideoId;
        if (/^\d+$/.test(videoId)) {
            // Numeric ID - look up the YouTube video_id
            const videoLookup = await client.query(
                'SELECT video_id FROM our_videos WHERE id = $1',
                [parseInt(videoId)]
            );
            if (videoLookup.rows.length === 0) {
                return res.json({
                    videoId,
                    questions: [],
                    totalQuestions: 0,
                    chunkDistribution: [],
                    maxQuestions: 15,
                    error: 'Video not found'
                });
            }
            actualVideoId = videoLookup.rows[0].video_id;
        } else {
            actualVideoId = videoId;
        }
        
        // Get existing questions with chunk info
        const questionsResult = await client.query(`
            SELECT 
                question, 
                options, 
                correct_answer, 
                question_type, 
                difficulty, 
                explanation, 
                question_index,
                chunk_index,
                chunk_total,
                chunk_text_preview
            FROM our_video_questions
            WHERE video_id = $1
            ORDER BY question_index
        `, [actualVideoId]);
        
        const questions = questionsResult.rows;
        
        // Get chunk distribution
        const chunkStats = await client.query(`
            SELECT 
                chunk_index,
                COUNT(*) as count
            FROM our_video_questions
            WHERE video_id = $1 AND chunk_index IS NOT NULL
            GROUP BY chunk_index
            ORDER BY chunk_index
        `, [actualVideoId]);
        
        // First check if video exists before trying to generate questions
        if (questions.length < 15 && req.session && req.session.userId) {
            // Verify video exists
            const videoCheck = await client.query(
                'SELECT COUNT(*) as count FROM our_videos WHERE video_id = $1',
                [actualVideoId]
            );
            
            if (parseInt(videoCheck.rows[0].count) > 0) {
                const userRoles = req.session.roles || [req.session.role || 'student'];
                const canGenerate = await canGenerateQuestions(req.session.userId, userRoles);
                
                if (canGenerate) {
                    // Trigger intelligent background generation
                    generateQuestionsBackgroundImproved(actualVideoId, questions.length);
                }
            } else {
                console.log(`Video ${actualVideoId} not found in database, skipping question generation`);
            }
        }
        
        res.json({
            videoId,
            questions,
            totalQuestions: questions.length,
            chunkDistribution: chunkStats.rows,
            maxQuestions: 15
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    } finally {
        client.release();
    }
});

// Improved background question generation
async function generateQuestionsBackgroundImproved(videoId, existingCount) {
    setImmediate(async () => {
        const client = await pool.connect();
        
        try {
            // Double-check current count
            const currentCountResult = await client.query(
                'SELECT COUNT(*) as count FROM our_video_questions WHERE video_id = $1',
                [videoId]
            );
            
            const currentCount = parseInt(currentCountResult.rows[0].count);
            if (currentCount >= 15) {
                return;
            }
            
            // Generate questions intelligently
            const newQuestions = await aiServiceImproved.generateQuestionsIntelligently(
                videoId, 
                currentCount,
                15
            );
            
            // Insert new questions with chunk info
            await client.query('BEGIN');
            
            for (let i = 0; i < newQuestions.length && currentCount + i < 15; i++) {
                const q = newQuestions[i];
                const questionIndex = currentCount + i;
                
                await client.query(`
                    INSERT INTO our_video_questions 
                    (video_id, question, options, correct_answer, question_type, 
                     difficulty, explanation, question_index, ai_model,
                     chunk_index, chunk_total, chunk_position, chunk_text_preview)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (video_id, question_index) DO NOTHING
                `, [
                    videoId,
                    q.question,
                    JSON.stringify(q.options),
                    q.correct_answer,
                    q.type || 'comprehension',
                    q.difficulty || 'medium',
                    q.explanation || '',
                    questionIndex,
                    'improved-generation',
                    q.chunk_index,
                    q.chunk_total,
                    q.chunk_position,
                    q.chunk_text_preview
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`Generated ${newQuestions.length} new questions for video ${videoId} from diverse chunks`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error generating questions in background:', error);
        } finally {
            client.release();
        }
    });
}

// Get question analytics for admin
router.get('/:videoId/analytics', requireAuth, async (req, res) => {
    const { videoId } = req.params;
    const userRoles = req.session.roles || [req.session.role || 'student'];
    
    if (!userRoles.includes('admin') && !userRoles.includes('teacher')) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const client = await pool.connect();
    
    try {
        // Get chunk coverage analysis
        const coverageResult = await client.query(`
            WITH video_chunks AS (
                SELECT 
                    COALESCE(MAX(chunk_total), 1) as total_chunks
                FROM our_video_questions
                WHERE video_id = $1
            ),
            chunk_coverage AS (
                SELECT 
                    chunk_index,
                    COUNT(*) as question_count,
                    STRING_AGG(question_type, ', ') as question_types,
                    MIN(chunk_position) as chunk_start
                FROM our_video_questions
                WHERE video_id = $1 AND chunk_index IS NOT NULL
                GROUP BY chunk_index
            )
            SELECT 
                c.chunk_index,
                c.question_count,
                c.question_types,
                c.chunk_start,
                v.total_chunks
            FROM chunk_coverage c
            CROSS JOIN video_chunks v
            ORDER BY c.chunk_index
        `, [videoId]);
        
        // Get duplicate analysis
        const duplicateResult = await client.query(`
            SELECT 
                question_hash,
                COUNT(*) as count,
                ARRAY_AGG(question) as questions
            FROM our_video_questions
            WHERE video_id = $1 AND question_hash IS NOT NULL
            GROUP BY question_hash
            HAVING COUNT(*) > 1
        `, [videoId]);
        
        res.json({
            videoId,
            chunkCoverage: coverageResult.rows,
            potentialDuplicates: duplicateResult.rows,
            recommendation: generateRecommendation(coverageResult.rows)
        });
        
    } catch (error) {
        console.error('Error fetching question analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    } finally {
        client.release();
    }
});

// Generate recommendation for question improvement
function generateRecommendation(chunkCoverage) {
    if (chunkCoverage.length === 0) {
        return "No questions generated yet. Generate initial questions.";
    }
    
    const avgQuestionsPerChunk = chunkCoverage.reduce((sum, c) => sum + c.question_count, 0) / chunkCoverage.length;
    const underrepresentedChunks = chunkCoverage.filter(c => c.question_count < avgQuestionsPerChunk * 0.7);
    
    if (underrepresentedChunks.length > 0) {
        return `Generate more questions for chunks: ${underrepresentedChunks.map(c => c.chunk_index + 1).join(', ')}`;
    }
    
    return "Good chunk coverage. Consider reviewing for quality and diversity.";
}

// Manual question generation with chunk selection
router.post('/:videoId/generate', requireAuth, async (req, res) => {
    const { videoId } = req.params;
    const { targetChunks, questionCount = 5 } = req.body;
    const userRoles = req.session.roles || [req.session.role || 'student'];
    
    if (!userRoles.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const client = await pool.connect();
    
    try {
        // Get current count
        const countResult = await client.query(
            'SELECT COUNT(*) as count FROM our_video_questions WHERE video_id = $1',
            [videoId]
        );
        
        const currentCount = parseInt(countResult.rows[0].count);
        
        if (currentCount >= 15) {
            return res.json({
                message: 'Maximum questions already reached',
                currentCount: 15
            });
        }
        
        // Get video content
        const videoResult = await client.query(`
            SELECT v.pure_subtitle, v.title, v.language_target,
                   ac.ai_content
            FROM our_videos v
            LEFT JOIN our_video_ai_content ac ON v.video_id = ac.video_id
            WHERE v.video_id = $1
        `, [videoId]);
        
        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const video = videoResult.rows[0];
        const content = video.ai_content || video.pure_subtitle;
        
        if (!content) {
            return res.status(400).json({ error: 'No content available for question generation' });
        }
        
        // Get existing questions
        const existingQuestions = await aiServiceImproved.getExistingQuestions(videoId);
        
        // Generate questions with chunk targeting
        const newQuestions = await aiServiceImproved.generateQuestionsFromChunks(content, {
            questionCount: Math.min(questionCount, 15 - currentCount),
            questionTypes: ['comprehension', 'vocabulary', 'grammar'],
            difficulty: 'intermediate',
            targetChunks: targetChunks,
            existingQuestions: existingQuestions,
            videoId: videoId
        });
        
        // Insert new questions
        await client.query('BEGIN');
        
        let insertedCount = 0;
        for (let i = 0; i < newQuestions.length && currentCount + insertedCount < 15; i++) {
            const q = newQuestions[i];
            const questionIndex = currentCount + insertedCount;
            
            await client.query(`
                INSERT INTO our_video_questions 
                (video_id, question, options, correct_answer, question_type, 
                 difficulty, explanation, question_index, ai_model,
                 chunk_index, chunk_total, chunk_position, chunk_text_preview)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (video_id, question_index) DO NOTHING
            `, [
                videoId,
                q.question,
                JSON.stringify(q.options),
                q.correct_answer,
                q.type || 'comprehension',
                q.difficulty || 'medium',
                q.explanation || '',
                questionIndex,
                'manual-improved',
                q.chunk_index,
                q.chunk_total,
                q.chunk_position,
                q.chunk_text_preview
            ]);
            
            insertedCount++;
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Generated ${insertedCount} new questions`,
            totalQuestions: currentCount + insertedCount,
            questionsGenerated: newQuestions.map(q => ({
                question: q.question,
                chunk: q.chunk_index
            }))
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error generating questions:', error);
        res.status(500).json({ error: 'Failed to generate questions' });
    } finally {
        client.release();
    }
});

module.exports = router;