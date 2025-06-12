const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        console.log('No userId in session');
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    console.log('Checking admin access for user:', req.session.userId);
    
    try {
        const result = await req.db.query(
            `SELECT COUNT(*) as count 
             FROM our_user_roles ur 
             JOIN our_roles r ON ur.role_id = r.id 
             WHERE ur.user_id = $1 AND r.name = 'admin'`,
            [req.session.userId]
        );
        
        console.log('Admin check result:', result.rows[0]);
        
        if (result.rows[0].count === '0') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all users with their roles
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT 
                u.id, 
                u.email, 
                u.username, 
                u.is_active,
                u.created_at,
                array_agg(r.name ORDER BY r.name) as roles
            FROM our_users u
            LEFT JOIN our_user_roles ur ON u.id = ur.user_id
            LEFT JOIN our_roles r ON ur.role_id = r.id
            GROUP BY u.id, u.email, u.username, u.is_active, u.created_at
            ORDER BY u.created_at DESC
        `);
        
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all available roles
router.get('/roles', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT id, name, description FROM our_roles ORDER BY name'
        );
        
        res.json({ roles: result.rows });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// Update user roles
router.put('/users/:userId/roles', isAuthenticated, isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { roles } = req.body; // Array of role names
    
    if (!Array.isArray(roles)) {
        return res.status(400).json({ error: 'Roles must be an array' });
    }
    
    const client = await req.db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Verify user exists
        const userResult = await client.query(
            'SELECT id FROM our_users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get role IDs
        const roleResult = await client.query(
            'SELECT id, name FROM our_roles WHERE name = ANY($1)',
            [roles]
        );
        
        const validRoles = roleResult.rows;
        
        // Delete existing roles
        await client.query(
            'DELETE FROM our_user_roles WHERE user_id = $1',
            [userId]
        );
        
        // Insert new roles
        for (const role of validRoles) {
            await client.query(
                'INSERT INTO our_user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
                [userId, role.id, req.session.userId]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: 'User roles updated successfully',
            roles: validRoles.map(r => r.name)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating user roles:', error);
        res.status(500).json({ error: 'Failed to update user roles' });
    } finally {
        client.release();
    }
});

// Toggle user active status
router.put('/users/:userId/toggle-active', isAuthenticated, isAdmin, async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await req.db.query(
            `UPDATE our_users 
             SET is_active = NOT is_active, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 
             RETURNING id, is_active`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
            success: true, 
            isActive: result.rows[0].is_active 
        });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Failed to toggle user status' });
    }
});

// Get system configuration
router.get('/config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT config_key, config_value, config_type, description FROM our_system_config ORDER BY config_key'
        );
        
        // Parse JSON/array values
        const configs = result.rows.map(row => {
            let value = row.config_value;
            if (row.config_type === 'array' || row.config_type === 'json') {
                try {
                    value = JSON.parse(row.config_value);
                } catch (e) {
                    console.error('Error parsing config value:', e);
                }
            } else if (row.config_type === 'boolean') {
                value = row.config_value === 'true';
            }
            
            return {
                key: row.config_key,
                value: value,
                type: row.config_type,
                description: row.description
            };
        });
        
        res.json({ configs });
    } catch (error) {
        console.error('Error fetching system config:', error);
        res.status(500).json({ error: 'Failed to fetch system configuration' });
    }
});

// Update system configuration
router.put('/config/:key', isAuthenticated, isAdmin, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    try {
        // Get current config to know the type
        const currentResult = await req.db.query(
            'SELECT config_type FROM our_system_config WHERE config_key = $1',
            [key]
        );
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Configuration key not found' });
        }
        
        const configType = currentResult.rows[0].config_type;
        let valueToStore = value;
        
        // Convert value based on type
        if (configType === 'array' || configType === 'json') {
            valueToStore = JSON.stringify(value);
        } else if (configType === 'boolean') {
            valueToStore = value ? 'true' : 'false';
        } else {
            valueToStore = String(value);
        }
        
        // Update the configuration
        const result = await req.db.query(
            `UPDATE our_system_config 
             SET config_value = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE config_key = $2 
             RETURNING config_key, config_value, config_type`,
            [valueToStore, key]
        );
        
        res.json({ 
            success: true, 
            config: {
                key: result.rows[0].config_key,
                value: configType === 'array' || configType === 'json' ? JSON.parse(result.rows[0].config_value) : result.rows[0].config_value,
                type: result.rows[0].config_type
            }
        });
    } catch (error) {
        console.error('Error updating system config:', error);
        res.status(500).json({ error: 'Failed to update system configuration' });
    }
});

module.exports = router; 