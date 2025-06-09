require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration: Adding user profile fields...');
        
        // Check if columns already exist
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'our_users' 
            AND column_name IN ('country', 'mother_language', 'timezone')
        `;
        
        const existingColumns = await client.query(checkQuery);
        const existingColumnNames = existingColumns.rows.map(row => row.column_name);
        
        // Add country column if it doesn't exist
        if (!existingColumnNames.includes('country')) {
            await client.query(`
                ALTER TABLE our_users 
                ADD COLUMN country VARCHAR(100)
            `);
            console.log('Added country column');
        }
        
        // Add mother_language column if it doesn't exist
        if (!existingColumnNames.includes('mother_language')) {
            await client.query(`
                ALTER TABLE our_users 
                ADD COLUMN mother_language VARCHAR(50)
            `);
            console.log('Added mother_language column');
        }
        
        // Add timezone column if it doesn't exist
        if (!existingColumnNames.includes('timezone')) {
            await client.query(`
                ALTER TABLE our_users 
                ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Berlin'
            `);
            console.log('Added timezone column');
        }
        
        console.log('Migration completed successfully!');
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error); 