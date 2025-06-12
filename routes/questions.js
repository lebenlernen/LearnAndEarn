const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const pool = require('../config/database');
const aiService = require('../services/ai-service');

// Check if user can generate questions
async function canGenerateQuestions(userId, userRoles) {
    const client = await pool.connect();
    
    try {
        // Get system configuration
        const configResult = await client.query(`
            SELECT config_value 
            FROM our_system_config 
            WHERE config_key = 'question_generation_allowed'
        `);
        
        if (configResult.rows.length === 0) {
            return false; // No config found, deny by default
        }
        
        const allowedRoles = JSON.parse(configResult.rows[0].config_value);
        
        // Check if any of the user's roles are in the allowed roles
        return userRoles.some(role => allowedRoles.includes(role));
    } catch (error) {
        console.error('Error checking question generation permissions:', error);
        return false;
    } finally {
        client.release();
    }
}

// Get questions for a video
router.get('/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const client = await pool.connect();
    
    try {
        // Get existing questions
        const questionsResult = await client.query(`
            SELECT question, options, correct_answer, question_type, 
                   difficulty, explanation, question_index
            FROM our_video_questions
            WHERE video_id = $1
            ORDER BY question_index
        `, [videoId]);
        
        const questions = questionsResult.rows;
        
        // Check if we should generate more questions
        if (questions.length < 15 && req.session && req.session.userId) {
            const userRoles = req.session.roles || [req.session.role || 'student'];
            const canGenerate = await canGenerateQuestions(req.session.userId, userRoles);
            
            if (canGenerate) {
                // Trigger background generation (non-blocking)
                generateQuestionsBackground(videoId, questions.length);
            }
        }
        
        res.json({
            videoId,
            questions,
            totalQuestions: questions.length
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    } finally {
        client.release();
    }
});

// Background question generation
async function generateQuestionsBackground(videoId, existingCount) {
    // Don't block the response - run in background
    setImmediate(async () => {
        const client = await pool.connect();
        
        try {
            // Double-check we still need more questions
            const currentCountResult = await client.query(
                'SELECT COUNT(*) as count FROM our_video_questions WHERE video_id = $1',
                [videoId]
            );
            
            const currentCount = parseInt(currentCountResult.rows[0].count);
            if (currentCount >= 15) {
                return; // Already have enough questions
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
                console.error('Video not found for question generation:', videoId);
                return;
            }
            
            const video = videoResult.rows[0];
            const content = video.ai_content || video.pure_subtitle;
            
            if (!content) {
                console.error('No content available for question generation:', videoId);
                return;
            }
            
            // Generate 3 new questions
            const newQuestions = await aiService.generateQuestionsFromTranscript(content, {
                questionCount: 3,
                questionTypes: ['comprehension', 'vocabulary', 'grammar'],
                difficulty: 'intermediate'
            });
            
            // Insert new questions
            await client.query('BEGIN');
            
            for (let i = 0; i < newQuestions.length && currentCount + i < 15; i++) {
                const q = newQuestions[i];
                const questionIndex = currentCount + i;
                
                await client.query(`
                    INSERT INTO our_video_questions 
                    (video_id, question, options, correct_answer, question_type, 
                     difficulty, explanation, question_index, ai_model)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
                    'background-generation'
                ]);
            }
            
            await client.query('COMMIT');
            console.log(`Generated ${newQuestions.length} new questions for video ${videoId}`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error generating questions in background:', error);
        } finally {
            client.release();
        }
    });
}

// Manually trigger question generation (admin only)
router.post('/:videoId/generate', requireAuth, async (req, res) => {
    const { videoId } = req.params;
    const userRoles = req.session.roles || [req.session.role || 'student'];
    
    // Check if user has admin role
    if (!userRoles.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const client = await pool.connect();
    
    try {
        // Get current question count
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
        
        // Generate questions to reach 15 total
        const questionsToGenerate = Math.min(5, 15 - currentCount);
        
        const newQuestions = await aiService.generateQuestionsFromTranscript(content, {
            questionCount: questionsToGenerate,
            questionTypes: ['comprehension', 'vocabulary', 'grammar'],
            difficulty: 'intermediate'
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
                 difficulty, explanation, question_index, ai_model)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
                'manual-generation'
            ]);
            
            insertedCount++;
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Generated ${insertedCount} new questions`,
            totalQuestions: currentCount + insertedCount
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