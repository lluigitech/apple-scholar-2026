const jwt = require('jsonwebtoken');

const normalizeRole = (role) => (typeof role === 'string' ? role.toLowerCase().trim() : role);
const jwtSecret = process.env.JWT_SECRET || 'apple_scholar_secret_2026';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });

        req.user = {
            ...decoded,
            role: normalizeRole(decoded.role),
        };
        next();
    });
};

const requireRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
};

module.exports = { verifyToken, requireRole };