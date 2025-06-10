const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
    user: 'learnandearn',
    host: 'localhost',
    database: 'learnandearn',
    password: 'securepassword123',
    port: 3013,
});

async function runMigration() {
    try {
        console.log('Running activity tracking migration...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'create_activity_tracking_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the SQL
        await pool.query(sql);
        
        console.log('✅ Activity tracking tables created successfully!');
        console.log('✅ Views for teacher and admin dashboards created!');
        console.log('✅ Triggers for automatic summary updates created!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();