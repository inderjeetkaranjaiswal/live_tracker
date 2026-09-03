const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/secretManager');

/**
 * Middleware to verify Bearer JWT token in Authorization header.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Access denied',
      message: 'No authorization token provided or invalid format. Header format: Bearer <token>'
    });
  }

  const token = authHeader.substring(7).trim();

  try {
    const secret = getJwtSecret();
    // Strictly specify allowed algorithms to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', message: 'JWT token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token', message: 'Token verification failed.' });
  }
}

/**
 * Middleware generator to enforce Role-Based Access Control (RBAC).
 * @param {Array<string>|string} allowedRoles
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Forbidden', message: 'User role not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role '${req.user.role}' is not authorized to perform this action. Required role: ${roles.join(' or ')}.`
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  requireRole
};
