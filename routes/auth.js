const express = require('express');
const bcrypt = require('bcrypt');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
    const { email, username, password } = req.body;
    
    // Validate input
    if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password are required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const client = await req.db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user already exists
        const existingUser = await client.query(
            'SELECT id FROM our_users WHERE email = $1 OR username = $2',
            [email, username]
        );
        
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'User with this email or username already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user (keeping role column as 'student' for backward compatibility)
        const userResult = await client.query(
            'INSERT INTO our_users (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username',
            [email, username, hashedPassword, 'student']
        );
        
        const user = userResult.rows[0];
        
        // Get student role ID
        const roleResult = await client.query(
            'SELECT id FROM our_roles WHERE name = $1',
            ['student']
        );
        
        if (roleResult.rows.length > 0) {
            // Assign student role in the junction table
            await client.query(
                'INSERT INTO our_user_roles (user_id, role_id) VALUES ($1, $2)',
                [user.id, roleResult.rows[0].id]
            );
        }
        
        await client.query('COMMIT');
        
        // Set session
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.username = user.username;
        req.session.roles = ['student']; // Store roles as array
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                roles: ['student']
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    } finally {
        client.release();
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    try {
        // Find user by email or username
        const result = await req.db.query(
            'SELECT id, email, username, password_hash, is_active FROM our_users WHERE email = $1 OR username = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is disabled' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Get user roles
        const rolesResult = await req.db.query(
            `SELECT r.name 
             FROM our_user_roles ur 
             JOIN our_roles r ON ur.role_id = r.id 
             WHERE ur.user_id = $1 
             ORDER BY r.name`,
            [user.id]
        );
        
        const roles = rolesResult.rows.map(row => row.name);
        
        // If no roles found (for backward compatibility), use 'student'
        if (roles.length === 0) {
            roles.push('student');
        }
        
        // Set session
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.username = user.username;
        req.session.roles = roles;
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                roles: roles
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.json({ success: true });
    });
});

// Get current user
router.get('/me', isAuthenticated, async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT id, email, username, is_active FROM our_users WHERE id = $1',
            [req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        
        // Get user roles
        const rolesResult = await req.db.query(
            `SELECT r.name 
             FROM our_user_roles ur 
             JOIN our_roles r ON ur.role_id = r.id 
             WHERE ur.user_id = $1 
             ORDER BY r.name`,
            [user.id]
        );
        
        const roles = rolesResult.rows.map(row => row.name);
        
        // If no roles found (for backward compatibility), use 'student'
        if (roles.length === 0) {
            roles.push('student');
        }
        
        res.json({ 
            authenticated: true, 
            user: {
                ...user,
                roles: roles
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
// TODO: Uncomment after running migration to add country, mother_language, timezone columns
router.put('/profile', isAuthenticated, async (req, res) => {
    res.status(503).json({ error: 'Profile update temporarily disabled. Please run database migration first.' });
    return;
    /*
    try {
        const { country, mother_language, timezone } = req.body;
        const userId = req.session.userId;
        
        // Validate timezone
        const validTimezones = Intl.supportedValuesOf('timeZone');
        if (timezone && !validTimezones.includes(timezone)) {
            return res.status(400).json({ error: 'Invalid timezone' });
        }
        
        const result = await req.db.query(
            `UPDATE our_users 
             SET country = $1, 
                 mother_language = $2, 
                 timezone = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, email, username, role, country, mother_language, timezone`,
            [country, mother_language, timezone, userId]
        );
        
        res.json({ 
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
    */
});

// Change password (authenticated users only)
router.post('/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    try {
        // Get user's current password hash
        const result = await req.db.query(
            'SELECT password_hash FROM our_users WHERE id = $1',
            [req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await req.db.query(
            'UPDATE our_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, req.session.userId]
        );
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router; 