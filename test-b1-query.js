const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 3143,
    database: 'jetzt',
    user: 'odoo',
    password: 'odoo',
});

async function testB1Query() {
    try {
        // Test the exact query that's failing
        const query = `
            SELECT COUNT(*) 
            FROM our_videos v 
            WHERE 1=1 
            AND ((v.title ILIKE $1 OR v.description ILIKE $1) AND (v.title ILIKE $2 OR v.description ILIKE $2))
            AND v.sub_manual = '1'
        `;
        
        const params = ['%b%', '%1%'];
        
        console.log('Testing query:', query);
        console.log('With params:', params);
        
        const result = await pool.query(query, params);
        console.log('Result:', result.rows[0]);
        
        // Also test simpler version
        const simpleQuery = `
            SELECT COUNT(*) 
            FROM our_videos v 
            WHERE (v.title ILIKE '%b1%' OR v.description ILIKE '%b1%')
            AND v.sub_manual = '1'
        `;
        
        console.log('\nTesting simple query:', simpleQuery);
        const simpleResult = await pool.query(simpleQuery);
        console.log('Simple result:', simpleResult.rows[0]);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testB1Query();
