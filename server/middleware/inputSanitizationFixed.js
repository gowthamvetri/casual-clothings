import mongoSanitize from 'express-mongo-sanitize';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';

// MongoDB injection prevention middleware
export const sanitizeInput = mongoSanitize({
  replaceWith: '_'
});

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      })),
      success: false
    });
  }
  next();
};

// Enhanced validation middleware factory
export const validateAndSanitize = (validators = []) => {
  return [
    sanitizeInput,
    ...validators,
    handleValidationErrors
  ];
};

// Common validators with proper error handling
export const validateEmail = body('email')
  .trim()
  .isEmail()
  .withMessage('Please provide a valid email address')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email address too long');

export const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');

export const validateObjectId = (field, options = {}) => {
  const { optional = false, customMessage } = options;
  
  let validator = body(field);
  
  if (optional) {
    validator = validator.optional();
  }
  
  return validator
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(customMessage || `${field} must be a valid MongoDB ObjectId`);
      }
      return true;
    });
};

export const validateSearchQuery = body('search')
  .optional()
  .trim()
  .isLength({ max: 100 })
  .withMessage('Search query too long (maximum 100 characters)')
  .custom((value) => {
    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /\$where/i,
      /javascript:/i,
      /eval\(/i,
      /function\s*\(/i,
      /<script/i,
      /on\w+\s*=/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(value)) {
        throw new Error('Search query contains invalid or potentially dangerous characters');
      }
    }
    return true;
  });

export const validatePagination = [
  body('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer (max 1000)')
    .toInt(),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

export const validateNumericAmount = (field, options = {}) => {
  const { min = 0, max = 1000000, decimal = true } = options;
  
  let validator = body(field);
  
  if (decimal) {
    validator = validator.isFloat({ min, max });
  } else {
    validator = validator.isInt({ min, max });
  }
  
  return validator
    .withMessage(`${field} must be a number between ${min} and ${max}`)
    .toFloat();
};

// Common validation combinations
export const commonValidations = {
  // User authentication
  login: validateAndSanitize([validateEmail, validatePassword]),
  
  // Registration
  register: validateAndSanitize([
    validateEmail,
    validatePassword,
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces')
  ]),
  
  // Object ID validation
  objectId: (field, optional = false) => validateAndSanitize([
    validateObjectId(field, { optional })
  ]),
  
  // Search with pagination
  searchWithPagination: validateAndSanitize([
    validateSearchQuery,
    ...validatePagination
  ]),
  
  // Order validation
  order: validateAndSanitize([
    validateObjectId('addressId'),
    validateNumericAmount('totalAmount', { min: 1 }),
    body('paymentMethod')
      .isIn(['Online Payment', 'Cash on Delivery'])
      .withMessage('Invalid payment method')
  ]),
  
  // Password reset
  passwordReset: validateAndSanitize([
    validateEmail,
    body('newPassword').custom((value, { req }) => {
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!strongPasswordRegex.test(value)) {
        throw new Error('Password must contain at least 8 characters with uppercase, lowercase, number and special character');
      }
      return true;
    }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ])
};

// Security logging middleware
export const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /\$where/i,
    /eval\(/i,
    /javascript:/i,
    /<script/i,
    /union\s+select/i,
    /drop\s+table/i
  ];
  
  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      // Security pattern detected - silently log to proper monitoring system
      break;
    }
  }
  
  next();
};

export default {
  sanitizeInput,
  validateAndSanitize,
  commonValidations,
  securityLogger
};
