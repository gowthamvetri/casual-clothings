import express from 'express';
import { 
  submitContactMessage, 
  getAllContactMessages, 
  updateMessageStatus, 
  addAdminReply,
  addAdminComment,
  deleteMessage,
  getUserContactHistory
} from '../controllers/contact.controller.js';
import auth from '../middleware/auth.js';
import { admin } from '../middleware/Admin.js';
import { contactLimiter } from '../middleware/rateLimitMiddleware.js';
import { validateContact } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Public route for submitting contact forms
router.post('/send', contactLimiter, validateContact, submitContactMessage);

// User route to get their own contact history
router.get('/user', auth, getUserContactHistory);

// Admin routes - protected with authentication and authorization
router.get('/all', auth, admin, getAllContactMessages);
router.put('/:id/status', auth, admin, updateMessageStatus);
router.post('/:id/reply', auth, admin, addAdminReply);
router.post('/:id/comment', auth, admin, addAdminComment);
router.delete('/:id', auth, admin, deleteMessage);

export default router;