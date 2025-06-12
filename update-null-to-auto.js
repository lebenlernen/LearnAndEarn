const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 3143,
    database: 'jetzt',
    user: 'odoo',
    password: 'odoo',
});

async function updateNullToAuto() {
    try {
        // First, show what we're about to update
        const preCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM our_videos
            WHERE sub_manual IS NULL
        `);
        
        console.log(`Found ${preCheck.rows[0].count} videos with sub_manual = NULL`);
        
        // Update NULL to 1 (auto-generated)
        const result = await pool.query(`
            UPDATE our_videos
            SET sub_manual = 1
            WHERE sub_manual IS NULL
        `);
        
        console.log(`Updated ${result.rowCount} videos from NULL to 1 (auto-generated)`);
        
        // Show new distribution
        const stats = await pool.query(`
            SELECT 
                sub_manual, 
                COUNT(*) as count
            FROM our_videos
            GROUP BY sub_manual
            ORDER BY sub_manual
        `);
        
        console.log('\nNew sub_manual distribution:');
        console.log(stats.rows);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateNullToAuto();
