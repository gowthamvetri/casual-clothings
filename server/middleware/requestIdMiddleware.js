import crypto from 'crypto';
import Logger from '../utils/logger.js';

// Generate unique request ID
const generateRequestId = () => {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

// Request ID middleware
export const requestIdMiddleware = (req, res, next) => {
  try {
    // Check if request already has an ID (from client or load balancer)
    const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    
    // Generate new ID if not present
    const requestId = existingId || generateRequestId();
    
    // Attach to request object
    req.requestId = requestId;
    
    // Add to response headers for tracking
    res.setHeader('X-Request-ID', requestId);
    
    // Log request details with ID
    const requestInfo = {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    // Log incoming request
    Logger.info('Request', `${req.method} ${req.path}`, requestInfo);
    
    // Capture response time
    const startTime = Date.now();
    
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const responseTime = Date.now() - startTime;
      
      Logger.info('Response', `${req.method} ${req.path} - ${res.statusCode}`, {
        requestId,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        path: req.path
      });
      
      // Add response time header
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      
      return originalJson.call(this, data);
    };
    
    // Handle errors with request ID
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        Logger.warn('ErrorResponse', `${req.method} ${req.path} - ${res.statusCode}`, {
          requestId,
          statusCode: res.statusCode,
          responseTime: `${Date.now() - startTime}ms`
        });
      }
    });
    
    next();
  } catch (error) {
    Logger.error('RequestIdMiddleware', 'Failed to generate request ID', error);
    next(); // Continue even if request ID generation fails
  }
};

// Middleware to attach request ID to error objects
export const attachRequestIdToError = (err, req, res, next) => {
  if (req.requestId) {
    err.requestId = req.requestId;
  }
  next(err);
};

export default {
  requestIdMiddleware,
  attachRequestIdToError
};
