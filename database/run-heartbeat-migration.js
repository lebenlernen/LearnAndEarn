const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 3143,
    database: 'jetzt',
    user: 'odoo',
    password: 'odoo',
});

async function runMigration() {
    try {
        console.log('Adding last_heartbeat column to our_activity_sessions...');
        
        await pool.query(`
            ALTER TABLE our_activity_sessions 
            ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        
        console.log('Migration completed successfully!');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();