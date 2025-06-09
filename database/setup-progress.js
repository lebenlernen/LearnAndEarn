const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3143,
    database: process.env.DB_DATABASE || 'jetzt',
    user: process.env.DB_USER || 'odoo',
    password: process.env.DB_PASSWORD || 'odoo',
});

async function setupProgressTables() {
    try {
        // Read the SQL file
        const sqlScript = await fs.readFile(path.join(__dirname, 'create_progress_tables.sql'), 'utf8');
        
        // Execute the SQL
        await pool.query(sqlScript);
        
        console.log('✅ Progress tracking tables created successfully!');
        
        // Check if tables were created
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('our_practice_sessions', 'our_user_video_progress', 'our_problem_sentences')
            ORDER BY table_name;
        `);
        
        console.log('\n📊 Created tables:');
        tableCheck.rows.forEach(row => console.log(`   - ${row.table_name}`));
        
        // Check triggers
        const triggerCheck = await pool.query(`
            SELECT trigger_name, event_object_table 
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name = 'update_progress_after_practice';
        `);
        
        if (triggerCheck.rows.length > 0) {
            console.log('\n🔧 Created triggers:');
            triggerCheck.rows.forEach(row => console.log(`   - ${row.trigger_name} on ${row.event_object_table}`));
        }
        
    } catch (error) {
        console.error('❌ Error setting up progress tables:', error);
    } finally {
        await pool.end();
    }
}

setupProgressTables(); 