
import Logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  Logger.error('Error handling request:', {
    url: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  } else if (err.code === 11000) {
    status = 400;
    message = 'Duplicate key error';
  } else if (err.name === 'MulterError') {
    // Handle Multer-specific errors
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large. Maximum size is 5MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    } else {
      message = 'File upload error: ' + err.message;
    }
  } else if (err.message && err.message.includes('Invalid file type')) {
    status = 400;
    message = err.message;
  }

  const errorResponse = {
    message,
    error: true,
    success: false,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };
  
  // Add additional debug info in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.details = err.stack;
    if (err.errors) {
      errorResponse.validationErrors = err.errors;
    }
  }
  
  res.status(status).json(errorResponse);
};

export default errorHandler;
