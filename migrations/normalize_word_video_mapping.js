require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration: Normalizing word-video mappings...');
        
        // Check if table already exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'our_word_video_mapping'
            );
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('Table our_word_video_mapping already exists. Checking if it needs updating...');
            
            // Check if table is empty
            const countResult = await client.query('SELECT COUNT(*) FROM our_word_video_mapping');
            const count = parseInt(countResult.rows[0].count);
            
            if (count > 0) {
                console.log(`Table already contains ${count} records. Skipping migration.`);
                return;
            }
        }
        
        // Read and execute the SQL file
        const sqlPath = path.join(__dirname, 'create_word_video_mapping.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split by semicolons and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.substring(0, 50) + '...');
                await client.query(statement);
            }
        }
        
        // Get statistics
        const stats = await client.query(`
            SELECT 
                COUNT(DISTINCT video_id) as video_count,
                COUNT(DISTINCT word) as unique_words,
                COUNT(*) as total_mappings
            FROM our_word_video_mapping
        `);
        
        console.log('\nMigration completed successfully!');
        console.log('Statistics:');
        console.log(`- Videos with vocabulary: ${stats.rows[0].video_count}`);
        console.log(`- Unique words: ${stats.rows[0].unique_words}`);
        console.log(`- Total word-video mappings: ${stats.rows[0].total_mappings}`);
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error); 