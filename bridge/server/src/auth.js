/**
 * Authentication middleware.
 *
 * Every API request (except /api/setup) must include:
 *   Authorization: Bearer <token>
 *
 * The token is generated once during setup and stored in config.
 * The phone stores the same token after pairing.
 */

const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createAuthMiddleware(config) {
  return (req, res, next) => {
    // Skip auth for setup endpoints (they handle their own)
    if (req.path.startsWith('/setup')) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header. Use: Bearer <token>'
      });
    }

    const token = authHeader.slice(7);
    if (token !== config.authToken) {
      return res.status(403).json({
        success: false,
        error: 'Invalid auth token'
      });
    }

    // Track last connection
    config.lastConnected = new Date().toISOString();
    next();
  };
}

module.exports = { createAuthMiddleware, generateToken };
