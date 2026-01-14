
import Joi from 'joi';

// Strong password regex: 8+ chars, 1 lowercase, 1 uppercase, 1 number, 1 special char
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const validateUser = (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
      email: Joi.string().email().max(255).required(),
      password: Joi.string()
        .min(8)
        .max(128)
        .pattern(strongPasswordRegex)
        .required()
        .messages({
          'string.pattern.base': 'Password must contain at least 8 characters with uppercase, lowercase, number and special character (@$!%*?&)',
          'string.min': 'Password must be at least 8 characters long',
          'string.max': 'Password must not exceed 128 characters'
        }),
      confirmPassword: Joi.string().max(128).required(),
      role: Joi.string().valid('user', 'admin')
    });
    
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        message: `Validation error: ${error.details[0].message}`,
        error: true,
        success: false
      });
    }

    // Check if passwords match
    if (req.body.password !== req.body.confirmPassword) {
      return res.status(400).json({
        message: 'Password and confirm password must match',
        error: true,
        success: false
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'User validation failed',
      error: true,
      success: false
    });
  }
};

export const validatePasswordReset = (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().max(255).required(),
      newPassword: Joi.string()
        .min(8)
        .max(128)
        .pattern(strongPasswordRegex)
        .required()
        .messages({
          'string.pattern.base': 'Password must contain at least 8 characters with uppercase, lowercase, number and special character (@$!%*?&)',
          'string.min': 'Password must be at least 8 characters long',
          'string.max': 'Password must not exceed 128 characters'
        }),
      confirmPassword: Joi.string().max(128).required()
    });
    
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        message: `Validation error: ${error.details[0].message}`,
        error: true,
        success: false
      });
    }
    
    // Check if passwords match
    if (req.body.newPassword !== req.body.confirmPassword) {
      return res.status(400).json({
        message: 'New password and confirm password must match',
        error: true,
        success: false
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Password validation failed',
      error: true,
      success: false
    });
  }
};

// Validate contact form submissions
export const validateContact = (req, res, next) => {
  try {
    const schema = Joi.object({
      fullName: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().max(255).required(),
      subject: Joi.string().min(3).max(200).required(),
      message: Joi.string().min(10).max(2000).required()
    });
    
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        message: `Validation error: ${error.details[0].message}`,
        error: true,
        success: false
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Contact form validation failed',
      error: true,
      success: false
    });
  }
};

// Validate address fields
export const validateAddress = (req, res, next) => {
  try {
    const schema = Joi.object({
      _id: Joi.string().optional(),
      address_line: Joi.string().min(10).max(200).required(),
      city: Joi.string().min(2).max(100).required(),
      state: Joi.string().min(2).max(100).required(),
      pincode: Joi.string().pattern(/^\d{6}$/).required().messages({
        'string.pattern.base': 'Pincode must be exactly 6 digits'
      }),
      country: Joi.string().min(2).max(100).required(),
      mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
        'string.pattern.base': 'Mobile number must be a valid 10-digit Indian number'
      }),
      addIframe: Joi.string().max(500).optional()
    });
    
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        message: `Validation error: ${error.details[0].message}`,
        error: true,
        success: false
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Address validation failed',
      error: true,
      success: false
    });
  }
};

// Validate product review/comment
export const validateReview = (req, res, next) => {
  try {
    const schema = Joi.object({
      text: Joi.string().min(10).max(1000).required(),
      rating: Joi.number().min(1).max(5).optional(),
      isPublic: Joi.boolean().optional(),
      displayToUser: Joi.boolean().optional()
    });
    
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        message: `Validation error: ${error.details[0].message}`,
        error: true,
        success: false
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Review validation failed',
      error: true,
      success: false
    });
  }
};

// Validate custom T-shirt request
export const validateCustomTshirt = (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().max(255).required(),
      phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
      size: Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL').required(),
      color: Joi.string().min(3).max(50).required(),
      design: Joi.string().min(10).max(1000).required(),
      quantity: Joi.number().min(1).max(1000).required(),
      additionalNotes: Joi.string().max(500).optional()
    });
    
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        message: `Validation error: ${error.details[0].message}`,
        error: true,
        success: false
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'Custom T-shirt validation failed',
      error: true,
      success: false
    });
  }
};