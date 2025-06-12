const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 3143,
    database: 'jetzt',
    user: 'odoo',
    password: 'odoo',
});

async function checkAll() {
    try {
        const stats = await pool.query(`
            SELECT 
                sub_manual, 
                COUNT(*) as count
            FROM our_videos
            GROUP BY sub_manual
            ORDER BY sub_manual
        `);
        
        console.log('Sub_manual distribution for ALL videos:');
        console.log(stats.rows);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAll();
