const { Pool } = require('pg');
const aiSummaryService = require('../services/ai-summary-service');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3143,
    database: process.env.DB_DATABASE || 'jetzt',
    user: process.env.DB_USER || 'odoo',
    password: process.env.DB_PASSWORD || 'odoo',
});

async function regenerateAISummary(videoId) {
    const client = await pool.connect();
    
    try {
        console.log(`Regenerating AI summary for video: ${videoId}`);
        
        // Get video details
        const videoResult = await client.query(
            'SELECT video_id, title, pure_subtitle, language_target FROM our_videos WHERE video_id = $1',
            [videoId]
        );
        
        if (videoResult.rows.length === 0) {
            throw new Error('Video not found');
        }
        
        const video = videoResult.rows[0];
        
        if (!video.pure_subtitle) {
            throw new Error('Video has no transcript');
        }
        
        console.log(`Found video: ${video.title}`);
        console.log(`Language: ${video.language_target || 'de'}`);
        
        // Reset status
        await client.query(`
            INSERT INTO our_video_ai_summaries (video_id, processing_status)
            VALUES ($1, 'processing')
            ON CONFLICT (video_id) 
            DO UPDATE SET 
                processing_status = 'processing',
                error_message = NULL,
                updated_at = NOW()
        `, [videoId]);
        
        // Generate summaries
        console.log('Generating AI summaries...');
        const summaries = await aiSummaryService.generateSummaries(
            video.title,
            video.pure_subtitle,
            video.language_target || 'de'
        );
        
        await client.query('BEGIN');
        
        // Update summary record
        await client.query(`
            UPDATE our_video_ai_summaries
            SET short_summary = $1,
                long_summary_raw = $2,
                ai_model = $3,
                ai_prompt_version = $4,
                processing_status = 'completed',
                updated_at = NOW()
            WHERE video_id = $5
        `, [
            summaries.shortSummary,
            summaries.longSummary,
            summaries.model,
            summaries.promptVersion,
            videoId
        ]);
        
        // Delete old AI sentences completely
        await client.query(`
            DELETE FROM our_video_sentences
            WHERE video_id = $1 AND source = 'ai_summary'
        `, [videoId]);
        
        // Insert new sentences
        console.log(`Inserting ${summaries.sentences.length} sentences...`);
        for (const sentence of summaries.sentences) {
            await client.query(`
                INSERT INTO our_video_sentences 
                (video_id, sentence, sentence_index, word_count, source, is_active)
                VALUES ($1, $2, $3, $4, 'ai_summary', true)
            `, [
                videoId,
                sentence.text,
                sentence.index,
                sentence.wordCount
            ]);
        }
        
        await client.query('COMMIT');
        
        console.log('✅ AI summary generated successfully!');
        console.log(`Short summary: ${summaries.shortSummary.substring(0, 100)}...`);
        console.log(`Sentences: ${summaries.sentences.length}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        
        // Mark as failed
        await client.query(`
            UPDATE our_video_ai_summaries
            SET processing_status = 'failed',
                error_message = $1,
                updated_at = NOW()
            WHERE video_id = $2
        `, [error.message, videoId]);
        
        console.error('❌ Failed to generate AI summary:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Get video ID from command line
const videoId = process.argv[2];
if (!videoId) {
    console.error('Usage: node regenerate-ai-summary.js <video-id>');
    process.exit(1);
}

// Run regeneration
regenerateAISummary(videoId).catch(console.error);