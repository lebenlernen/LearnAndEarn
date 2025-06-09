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

async function fixTimezone() {
    try {
        console.log('🕐 Fixing timezone handling in database...\n');
        
        // Check current timezone
        const tzResult = await pool.query("SELECT current_setting('TIMEZONE') as tz");
        console.log(`Current database timezone: ${tzResult.rows[0].tz}`);
        
        // Read SQL file
        const sqlPath = path.join(__dirname, 'fix-timezone.sql');
        const sql = await fs.readFile(sqlPath, 'utf8');
        
        // Execute SQL commands
        await pool.query(sql);
        
        console.log('\n✅ Timezone handling fixed successfully!');
        console.log('\nTimestamp columns have been converted to TIMESTAMPTZ (timestamp with timezone).');
        console.log('This ensures proper timezone handling when storing and retrieving dates.\n');
        
        // Show current time in different formats
        const timeCheck = await pool.query(`
            SELECT 
                current_setting('TIMEZONE') as database_timezone,
                NOW() as current_timestamp_with_tz,
                NOW()::timestamp as current_timestamp_without_tz,
                NOW() AT TIME ZONE 'Europe/Berlin' as berlin_time
        `);
        
        console.log('Current time information:');
        console.log('- Database timezone:', timeCheck.rows[0].database_timezone);
        console.log('- Current timestamp (with TZ):', timeCheck.rows[0].current_timestamp_with_tz);
        console.log('- Berlin time:', timeCheck.rows[0].berlin_time);
        
    } catch (error) {
        console.error('❌ Error fixing timezone:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

fixTimezone(); 