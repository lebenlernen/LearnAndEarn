const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 3143,
    database: 'jetzt',
    user: 'odoo',
    password: 'odoo',
});

async function checkB1() {
    try {
        const stats = await pool.query(`
            SELECT 
                sub_manual, 
                COUNT(*) as count
            FROM our_videos
            WHERE title ILIKE '%b1%' OR description ILIKE '%b1%'
            GROUP BY sub_manual
            ORDER BY sub_manual
        `);
        
        console.log('Sub_manual distribution for B1 videos:');
        console.log(stats.rows);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkB1();
