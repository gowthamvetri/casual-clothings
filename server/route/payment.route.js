import express from 'express';
import { 
    getAllPayments, 
    getPaymentStats, 
    getPaymentStatsWithDelivery,
    downloadInvoice, 
    initiateRefund, 
    handleRefundCompletion,
    handleDeliveryCompletion,
    getPaymentSettings, 
    updatePaymentSettings 
} from '../controllers/payment.controller.js';
import { 
    handleRazorpayWebhook, 
    verifyPayment,
    createRazorpayOrder 
} from '../controllers/razorpayWebhook.controller.js';
import { getPaymentConfig } from '../controllers/paymentConfig.controller.js';
import auth from '../middleware/auth.js';
import { admin } from '../middleware/Admin.js';
import { paymentLimiter } from '../middleware/rateLimitMiddleware.js';

const paymentRouter = express.Router();

// Get payment configuration (frontend needs this for Razorpay key)
paymentRouter.get('/config', getPaymentConfig);

// Razorpay webhook endpoint (MUST be before other routes, NO AUTH)
// This endpoint receives payment confirmations from Razorpay servers
paymentRouter.post('/razorpay/webhook', handleRazorpayWebhook);

// Create Razorpay order (called by frontend before payment)
paymentRouter.post('/razorpay/create-order', auth, paymentLimiter, createRazorpayOrder);

// Manual payment verification endpoint (called by frontend after payment)
paymentRouter.post('/razorpay/verify', auth, paymentLimiter, verifyPayment);

// Get all payments with filters (Admin only)
paymentRouter.post('/all', auth, admin, getAllPayments);

// Get payment statistics (Admin only)
paymentRouter.get('/stats', auth, admin, getPaymentStats);

// Get payment statistics with delivery insights (Admin only)
paymentRouter.get('/stats/delivery', auth, admin, getPaymentStatsWithDelivery);

// Download invoice (Admin only)
paymentRouter.post('/invoice/download', auth, admin, downloadInvoice);

// Download user's own invoice (User route)
paymentRouter.post('/invoice/download-user', auth, downloadInvoice);

// Initiate refund (Admin only)
paymentRouter.post('/refund/initiate', auth, admin, initiateRefund);

// Complete refund and send email with invoice (Admin only)
paymentRouter.post('/refund/complete', auth, admin, handleRefundCompletion);

// Complete delivery and send email with invoice (Admin only)
paymentRouter.post('/delivery/complete', auth, admin, handleDeliveryCompletion);

// Get payment gateway settings (Admin only)
paymentRouter.get('/settings', auth, admin, getPaymentSettings);

// Update payment gateway settings (Admin only)
paymentRouter.post('/settings/update', auth, admin, updatePaymentSettings);

export default paymentRouter;
