const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set in environment variables.');
}

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const cookieToken = req.cookies && req.cookies.token;

  // prefer Authorization header if present (expects "Bearer <token>")
  let tokenString = null;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      tokenString = parts[1];
    } else {
      // if header is present but not Bearer, try last part as fallback
      tokenString = parts[parts.length - 1];
    }
  } else if (cookieToken) {
    tokenString = cookieToken;
  }

  if (!tokenString) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    // server-side log for debugging (do not expose stack to clients)
    console.error('verifyToken error:', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};