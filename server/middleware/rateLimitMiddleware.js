import rateLimit from 'express-rate-limit';

// Basic rate limiter
export const basicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 10000 requests per windowMs
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for auth routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login/register attempts per windowMs
  message: {
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    message: 'Too many search requests, please try again after a minute',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for product listing
export const productLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    message: 'Too many product requests, please slow down',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for cart operations
export const cartLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 cart operations per minute
  message: {
    message: 'Too many cart operations, please try again shortly',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for payment endpoints
export const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 payment attempts per 5 minutes
  message: {
    message: 'Too many payment attempts, please try again after 5 minutes',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Rate limiter for order operations
export const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 order operations per 5 minutes
  message: {
    message: 'Too many order requests, please try again shortly',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for upload operations
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 uploads per 10 minutes
  message: {
    message: 'Too many upload requests, please try again later',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for contact/email endpoints
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 messages per hour
  message: {
    message: 'Too many messages sent, please try again after an hour',
    error: true,
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default {
  basicLimiter,
  authLimiter,
  searchLimiter,
  productLimiter,
  cartLimiter,
  paymentLimiter,
  orderLimiter,
  uploadLimiter,
  contactLimiter
};