const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 3143,
    database: 'jetzt',
    user: 'odoo',
    password: 'odoo',
});

async function checkSubManual() {
    try {
        // Check distribution
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
        
        // Check a few examples
        const examples = await pool.query(`
            SELECT id, title, sub_manual
            FROM our_videos
            WHERE title ILIKE '%b1%' OR description ILIKE '%b1%'
            LIMIT 5
        `);
        
        console.log('\nExample videos:');
        examples.rows.forEach(row => {
            console.log(`ID: ${row.id}, Title: ${row.title}, sub_manual: ${row.sub_manual}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSubManual();
