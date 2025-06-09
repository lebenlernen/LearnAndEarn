const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3143,
    database: process.env.DB_DATABASE || 'jetzt',
    user: process.env.DB_USER || 'odoo',
    password: process.env.DB_PASSWORD || 'odoo',
});

async function addAdminUser() {
    const email = 'thomas.seewald@gmail.com';
    const username = 'thomas.seewald';
    const password = 'DResdner';
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user already exists
        const existingUser = await client.query(
            'SELECT id FROM our_users WHERE email = $1',
            [email]
        );
        
        let userId;
        
        if (existingUser.rows.length > 0) {
            // User exists, update password
            userId = existingUser.rows[0].id;
            const hashedPassword = await bcrypt.hash(password, 10);
            
            await client.query(
                'UPDATE our_users SET password_hash = $1, is_active = true WHERE id = $2',
                [hashedPassword, userId]
            );
            
            console.log('Updated existing user password');
        } else {
            // Create new user
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const result = await client.query(
                'INSERT INTO our_users (email, username, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [email, username, hashedPassword, 'admin', true]
            );
            
            userId = result.rows[0].id;
            console.log('Created new user');
        }
        
        // Get admin role ID
        const roleResult = await client.query(
            'SELECT id FROM our_roles WHERE name = $1',
            ['admin']
        );
        
        if (roleResult.rows.length === 0) {
            throw new Error('Admin role not found. Please run the roles migration first.');
        }
        
        const adminRoleId = roleResult.rows[0].id;
        
        // Check if user already has admin role
        const existingRole = await client.query(
            'SELECT * FROM our_user_roles WHERE user_id = $1 AND role_id = $2',
            [userId, adminRoleId]
        );
        
        if (existingRole.rows.length === 0) {
            // Assign admin role
            await client.query(
                'INSERT INTO our_user_roles (user_id, role_id) VALUES ($1, $2)',
                [userId, adminRoleId]
            );
            console.log('Assigned admin role');
        } else {
            console.log('User already has admin role');
        }
        
        // Also ensure they have student role (since users can have multiple roles)
        const studentRoleResult = await client.query(
            'SELECT id FROM our_roles WHERE name = $1',
            ['student']
        );
        
        if (studentRoleResult.rows.length > 0) {
            const studentRoleId = studentRoleResult.rows[0].id;
            
            const existingStudentRole = await client.query(
                'SELECT * FROM our_user_roles WHERE user_id = $1 AND role_id = $2',
                [userId, studentRoleId]
            );
            
            if (existingStudentRole.rows.length === 0) {
                await client.query(
                    'INSERT INTO our_user_roles (user_id, role_id) VALUES ($1, $2)',
                    [userId, studentRoleId]
                );
                console.log('Also assigned student role');
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n✅ Admin user created/updated successfully!');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('Roles: admin, student');
        console.log('\nYou can now login and access the admin panel.');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

addAdminUser(); 