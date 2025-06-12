const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3143,
    database: process.env.DB_DATABASE || 'jetzt',
    user: process.env.DB_USER || 'odoo',
    password: process.env.DB_PASSWORD || 'odoo',
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('Starting AI summary migration...');
        
        // 1. Create AI summaries table
        console.log('Creating AI summaries table...');
        const createTableSQL = fs.readFileSync(
            path.join(__dirname, 'create_ai_summaries_table.sql'), 
            'utf8'
        );
        await client.query(createTableSQL);
        console.log('✓ AI summaries table created');
        
        // 2. Add source column to video sentences table
        console.log('Adding source column to video sentences table...');
        try {
            await client.query(`
                ALTER TABLE our_video_sentences 
                ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'transcript'
            `);
            console.log('✓ Source column added');
        } catch (error) {
            if (error.code === '42701') { // Column already exists
                console.log('✓ Source column already exists');
            } else {
                throw error;
            }
        }
        
        // 3. Add is_active column if it doesn't exist
        console.log('Adding is_active column to video sentences table...');
        try {
            await client.query(`
                ALTER TABLE our_video_sentences 
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
            `);
            console.log('✓ is_active column added');
        } catch (error) {
            if (error.code === '42701') { // Column already exists
                console.log('✓ is_active column already exists');
            } else {
                throw error;
            }
        }
        
        // 4. Update existing sentences to have source = 'transcript'
        console.log('Updating existing sentences source...');
        const updateResult = await client.query(`
            UPDATE our_video_sentences 
            SET source = 'transcript' 
            WHERE source IS NULL
        `);
        console.log(`✓ Updated ${updateResult.rowCount} sentences`);
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
runMigration().catch(console.error);