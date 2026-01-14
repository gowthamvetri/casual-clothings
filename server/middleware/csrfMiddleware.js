import crypto from 'crypto';

// In-memory CSRF token store (for production, consider using Redis)
const csrfTokenStore = new Map();

// Token expiry time (15 minutes)
const TOKEN_EXPIRY = 15 * 60 * 1000;

// Generate CSRF token
export const generateCsrfToken = (req, res, next) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const userId = req.userId || req.sessionID || req.ip;
    
    // Store token with expiry
    csrfTokenStore.set(userId, {
      token,
      expires: Date.now() + TOKEN_EXPIRY
    });
    
    // Clean up expired tokens periodically
    if (csrfTokenStore.size > 1000) {
      cleanupExpiredTokens();
    }
    
    // Send token in response header and cookie
    res.setHeader('X-CSRF-Token', token);
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Allow JavaScript to read for AJAX requests
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRY
    });
    
    req.csrfToken = token;
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to generate CSRF token',
      error: true,
      success: false
    });
  }
};

// Verify CSRF token for state-changing operations
export const verifyCsrfToken = (req, res, next) => {
  try {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const userId = req.userId || req.sessionID || req.ip;
    const tokenFromHeader = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    const tokenFromBody = req.body?._csrf;
    const token = tokenFromHeader || tokenFromBody;
    
    if (!token) {
      return res.status(403).json({
        message: 'CSRF token missing',
        error: true,
        success: false,
        code: 'CSRF_TOKEN_MISSING'
      });
    }
    
    const storedToken = csrfTokenStore.get(userId);
    
    if (!storedToken) {
      return res.status(403).json({
        message: 'CSRF token not found or expired',
        error: true,
        success: false,
        code: 'CSRF_TOKEN_INVALID'
      });
    }
    
    // Check if token is expired
    if (Date.now() > storedToken.expires) {
      csrfTokenStore.delete(userId);
      return res.status(403).json({
        message: 'CSRF token expired',
        error: true,
        success: false,
        code: 'CSRF_TOKEN_EXPIRED'
      });
    }
    
    // Verify token
    if (storedToken.token !== token) {
      return res.status(403).json({
        message: 'Invalid CSRF token',
        error: true,
        success: false,
        code: 'CSRF_TOKEN_INVALID'
      });
    }
    
    // Token is valid, proceed
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'CSRF token verification failed',
      error: true,
      success: false
    });
  }
};

// Cleanup expired tokens
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [userId, data] of csrfTokenStore.entries()) {
    if (now > data.expires) {
      csrfTokenStore.delete(userId);
    }
  }
}

// Endpoint to get CSRF token
export const getCsrfToken = (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const userId = req.userId || req.sessionID || req.ip;
    
    csrfTokenStore.set(userId, {
      token,
      expires: Date.now() + TOKEN_EXPIRY
    });
    
    return res.status(200).json({
      message: 'CSRF token generated',
      success: true,
      csrfToken: token
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to generate CSRF token',
      error: true,
      success: false
    });
  }
};

// Optional: Simpler CSRF protection for less critical operations
export const csrfProtectionOptional = (req, res, next) => {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Warn but don't block if token is missing
  const token = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  if (!token) {
    req.csrfWarning = true;
  }
  
  next();
};

export default {
  generateCsrfToken,
  verifyCsrfToken,
  getCsrfToken,
  csrfProtectionOptional
};