const jwt = require('jsonwebtoken');

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.userId) {
        // Set user object on request
        req.user = {
            id: req.session.userId,
            email: req.session.email,
            username: req.session.username,
            role: req.session.role || (req.session.roles ? req.session.roles[0] : 'student'),
            roles: req.session.roles || [req.session.role || 'student']
        };
        next();
    } else {
        res.status(401).json({ error: 'Authentifizierung erforderlich' });
    }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Administratorzugriff erforderlich' });
    }
};

// Optional authentication - doesn't fail if not authenticated
const optionalAuth = (req, res, next) => {
    // Just proceed, session info will be available if user is logged in
    next();
};

// Generate JWT token (for API usage if needed later)
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Verify JWT token (for API usage if needed later)
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = {
    isAuthenticated,
    isAdmin,
    optionalAuth,
    generateToken,
    verifyToken
}; 