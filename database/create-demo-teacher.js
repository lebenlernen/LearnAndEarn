const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3143,
    database: process.env.DB_DATABASE || 'jetzt',
    user: process.env.DB_USER || 'odoo',
    password: process.env.DB_PASSWORD || 'odoo',
});

async function createDemoTeacher() {
    try {
        // Create a demo school
        const schoolResult = await pool.query(`
            INSERT INTO our_schools (name)
            VALUES ('Demo Schule')
            ON CONFLICT DO NOTHING
            RETURNING id
        `);
        
        let schoolId;
        if (schoolResult.rows.length > 0) {
            schoolId = schoolResult.rows[0].id;
        } else {
            // School already exists, get its ID
            const existingSchool = await pool.query(
                "SELECT id FROM our_schools WHERE name = 'Demo Schule'"
            );
            schoolId = existingSchool.rows[0].id;
        }
        
        // Create demo teacher account
        const email = 'teacher@demo.com';
        const username = 'Demo Lehrer';
        const password = 'teacher123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Check if teacher already exists
        const existingUser = await pool.query(
            'SELECT id FROM our_users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            // Update existing user to be a teacher
            await pool.query(`
                UPDATE our_users 
                SET is_teacher = true, school_id = $1, username = $2
                WHERE email = $3
            `, [schoolId, username, email]);
            
            console.log('Existing user updated as teacher');
        } else {
            // Create new teacher user
            await pool.query(`
                INSERT INTO our_users (email, username, password_hash, is_active, is_teacher, school_id, timezone)
                VALUES ($1, $2, $3, true, true, $4, 'Europe/Berlin')
            `, [email, username, passwordHash, schoolId]);
            
            console.log('Demo teacher created successfully');
        }
        
        console.log('-----------------------------------');
        console.log('Demo Teacher Account:');
        console.log('Email: teacher@demo.com');
        console.log('Password: teacher123');
        console.log('-----------------------------------');
        
        // Create a demo class
        const teacherResult = await pool.query(
            'SELECT id FROM our_users WHERE email = $1',
            [email]
        );
        const teacherId = teacherResult.rows[0].id;
        
        await pool.query(`
            INSERT INTO our_classes (school_id, teacher_id, name, description)
            VALUES ($1, $2, 'Deutsch A2', 'Deutschkurs für Anfänger mit Grundkenntnissen')
            ON CONFLICT DO NOTHING
        `, [schoolId, teacherId]);
        
        console.log('Demo class created');
        
    } catch (error) {
        console.error('Error creating demo teacher:', error);
    } finally {
        await pool.end();
    }
}

createDemoTeacher();