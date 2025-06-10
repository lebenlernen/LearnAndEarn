const express = require('express');
const bcrypt = require('bcrypt');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
    const { email, username, password } = req.body;
    
    // Validate input
    if (!email || !username || !password) {
        return res.status(400).json({ error: 'E-Mail, Benutzername und Passwort sind erforderlich' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
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
            return res.status(400).json({ error: 'Ein Benutzer mit dieser E-Mail oder diesem Benutzernamen existiert bereits' });
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
        res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    } finally {
        client.release();
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
    }
    
    try {
        // Find user by email or username
        const result = await req.db.query(
            'SELECT id, email, username, password_hash, is_active FROM our_users WHERE email = $1 OR username = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }
        
        const user = result.rows[0];
        
        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({ error: 'Konto ist deaktiviert' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
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
        
        // Ensure session is saved before sending response
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Sitzung konnte nicht gespeichert werden' });
            }
            
            res.json({ 
                success: true, 
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    roles: roles
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Abmeldung fehlgeschlagen' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.json({ success: true });
    });
});

// Get current user
router.get('/me', isAuthenticated, async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT id, email, username, is_active, country, mother_language, timezone, use_system_dictation FROM our_users WHERE id = $1',
            [req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
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
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// Update user profile
router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const { country, mother_language, timezone, use_system_dictation } = req.body;
        const userId = req.session.userId;
        
        // Validate timezone if provided
        if (timezone) {
            const validTimezones = Intl.supportedValuesOf('timeZone');
            if (!validTimezones.includes(timezone)) {
                return res.status(400).json({ error: 'Ungültige Zeitzone' });
            }
        }
        
        const result = await req.db.query(
            `UPDATE our_users 
             SET country = $1, 
                 mother_language = $2, 
                 timezone = $3,
                 use_system_dictation = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING id, email, username, country, mother_language, timezone, use_system_dictation`,
            [country, mother_language, timezone, use_system_dictation, userId]
        );
        
        res.json({ 
            message: 'Profil erfolgreich aktualisiert',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Profilaktualisierung fehlgeschlagen' });
    }
});

// Change password (authenticated users only)
router.post('/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein' });
    }
    
    try {
        // Get user's current password hash
        const result = await req.db.query(
            'SELECT password_hash FROM our_users WHERE id = $1',
            [req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Das aktuelle Passwort ist falsch' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await req.db.query(
            'UPDATE our_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, req.session.userId]
        );
        
        res.json({ success: true, message: 'Passwort erfolgreich aktualisiert' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Passwortänderung fehlgeschlagen' });
    }
});

module.exports = router; 