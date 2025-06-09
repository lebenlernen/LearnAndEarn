const { Pool } = require('pg');
const bcrypt = require('bcrypt');
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

async function setupAuth() {
    try {
        // Read the SQL file
        const sqlScript = await fs.readFile(path.join(__dirname, 'create_auth_tables.sql'), 'utf8');
        
        // Generate password hash for admin
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        // Replace placeholder with actual hash
        const sqlWithHash = sqlScript.replace('$2b$10$YourHashHere', hashedPassword);
        
        // Execute the SQL
        await pool.query(sqlWithHash);
        
        console.log('✅ Authentication tables created successfully!');
        console.log('📧 Default admin user: admin@learnandearn.com');
        console.log('🔑 Default password: admin123');
        console.log('⚠️  IMPORTANT: Change the admin password after first login!');
        
        // Check if tables were created
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('our_users', 'our_sessions', 'our_user_learning_progress')
            ORDER BY table_name;
        `);
        
        console.log('\n📊 Created tables:');
        tableCheck.rows.forEach(row => console.log(`   - ${row.table_name}`));
        
    } catch (error) {
        console.error('❌ Error setting up authentication:', error);
    } finally {
        await pool.end();
    }
}

setupAuth(); 