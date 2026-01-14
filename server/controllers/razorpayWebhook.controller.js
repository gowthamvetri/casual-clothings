import crypto from 'crypto';
import Razorpay from 'razorpay';
import orderModel from '../models/order.model.js';
import sendEmail from '../config/sendEmail.js';
import UserModel from '../models/users.model.js';

// Validate Razorpay configuration
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('❌ CRITICAL: Razorpay credentials not configured!');
    console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
} else {
    const isLiveMode = process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_');
    const mode = isLiveMode ? 'LIVE' : 'TEST';
    console.log(`💳 Razorpay initialized in ${mode} mode`);
    if (isLiveMode) {
        console.log('⚠️  LIVE MODE: Real transactions will be processed');
    }
}

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Verify Razorpay webhook signature
 * @param {string} webhookBody - Raw webhook body as string
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} webhookSecret - Webhook secret from Razorpay dashboard
 * @returns {boolean} - True if signature is valid
 */
const verifyWebhookSignature = (webhookBody, signature, webhookSecret) => {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(webhookBody)
            .digest('hex');
        
        return expectedSignature === signature;
    } catch (error) {
        console.error('Error verifying webhook signature:', error);
        return false;
    }
};

/**
 * Handle Razorpay webhook events
 * This endpoint receives payment confirmations from Razorpay
 * 
 * Events handled:
 * - payment.authorized: Payment authorized but not captured
 * - payment.captured: Payment successfully captured
 * - payment.failed: Payment failed
 * - order.paid: Order fully paid
 */
export const handleRazorpayWebhook = async (req, res) => {
    try {
        // Get raw body and signature
        const webhookBody = JSON.stringify(req.body);
        const signature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        console.log('📥 Received Razorpay webhook event');

        // Verify webhook signature
        if (!webhookSecret) {
            console.error('❌ RAZORPAY_WEBHOOK_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: true,
                message: 'Webhook secret not configured'
            });
        }

        const isValid = verifyWebhookSignature(webhookBody, signature, webhookSecret);
        
        if (!isValid) {
            console.error('❌ Invalid webhook signature');
            return res.status(400).json({
                success: false,
                error: true,
                message: 'Invalid signature'
            });
        }

        console.log('✅ Webhook signature verified');

        // Parse webhook event
        const event = req.body.event;
        const payload = req.body.payload;

        console.log(`📦 Event type: ${event}`);

        // Handle different event types
        switch (event) {
            case 'payment.captured':
                await handlePaymentCaptured(payload.payment.entity);
                break;

            case 'payment.authorized':
                await handlePaymentAuthorized(payload.payment.entity);
                break;

            case 'payment.failed':
                await handlePaymentFailed(payload.payment.entity);
                break;

            case 'order.paid':
                await handleOrderPaid(payload.order.entity, payload.payment.entity);
                break;

            default:
                console.log(`ℹ️ Unhandled event type: ${event}`);
        }

        // Always return 200 to acknowledge receipt
        return res.status(200).json({
            success: true,
            message: 'Webhook processed'
        });

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        // Still return 200 to prevent Razorpay from retrying
        return res.status(200).json({
            success: false,
            error: true,
            message: 'Webhook processing error'
        });
    }
};

/**
 * Handle payment.captured event
 * This is called when payment is successfully captured
 */
const handlePaymentCaptured = async (payment) => {
    try {
        console.log(`💰 Payment captured: ${payment.id}`);
        
        // Extract order ID from notes or receipt
        const orderId = payment.notes?.orderId || payment.order_id;
        
        if (!orderId) {
            console.error('❌ No order ID found in payment notes');
            return;
        }

        // Find the order in database
        const order = await orderModel.findOne({ orderId: orderId });
        
        if (!order) {
            console.error(`❌ Order not found: ${orderId}`);
            return;
        }

        // Check if already processed
        if (order.paymentStatus === 'PAID') {
            console.log(`ℹ️ Order ${orderId} already marked as PAID`);
            return;
        }

        // Update order with payment details
        order.paymentStatus = 'PAID';
        order.paymentId = payment.id;
        order.paymentMethod = payment.method || 'Online Payment';
        order.orderStatus = 'ORDER PLACED';
        order.razorpayPaymentDetails = {
            paymentId: payment.id,
            orderId: payment.order_id,
            amount: payment.amount / 100, // Convert paise to rupees
            currency: payment.currency,
            status: payment.status,
            method: payment.method,
            capturedAt: new Date(payment.created_at * 1000),
            email: payment.email,
            contact: payment.contact
        };

        await order.save();

        console.log(`✅ Order ${orderId} updated - Payment confirmed`);

        // Send confirmation email to customer
        await sendPaymentConfirmationEmail(order);

    } catch (error) {
        console.error('Error handling payment.captured:', error);
    }
};

/**
 * Handle payment.authorized event
 * Payment is authorized but not yet captured (for manual capture flow)
 */
const handlePaymentAuthorized = async (payment) => {
    try {
        console.log(`🔐 Payment authorized: ${payment.id}`);
        
        const orderId = payment.notes?.orderId || payment.order_id;
        
        if (!orderId) {
            console.error('❌ No order ID found in payment notes');
            return;
        }

        const order = await orderModel.findOne({ orderId: orderId });
        
        if (!order) {
            console.error(`❌ Order not found: ${orderId}`);
            return;
        }

        // Update to authorized status (waiting for capture)
        order.paymentStatus = 'AUTHORIZED';
        order.paymentId = payment.id;
        order.razorpayPaymentDetails = {
            paymentId: payment.id,
            orderId: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: payment.status,
            method: payment.method,
            authorizedAt: new Date(payment.created_at * 1000)
        };

        await order.save();

        console.log(`✅ Order ${orderId} marked as AUTHORIZED`);

    } catch (error) {
        console.error('Error handling payment.authorized:', error);
    }
};

/**
 * Handle payment.failed event
 * Payment attempt failed
 */
const handlePaymentFailed = async (payment) => {
    try {
        console.log(`❌ Payment failed: ${payment.id}`);
        
        const orderId = payment.notes?.orderId || payment.order_id;
        
        if (!orderId) {
            console.error('❌ No order ID found in payment notes');
            return;
        }

        const order = await orderModel.findOne({ orderId: orderId });
        
        if (!order) {
            console.error(`❌ Order not found: ${orderId}`);
            return;
        }

        // Update order status to failed
        order.paymentStatus = 'FAILED';
        order.paymentId = payment.id;
        order.orderStatus = 'PAYMENT FAILED';
        order.razorpayPaymentDetails = {
            paymentId: payment.id,
            orderId: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: payment.status,
            method: payment.method,
            failedAt: new Date(payment.created_at * 1000),
            errorCode: payment.error_code,
            errorDescription: payment.error_description,
            errorReason: payment.error_reason
        };

        await order.save();

        console.log(`✅ Order ${orderId} marked as FAILED`);

        // Send payment failure email
        await sendPaymentFailureEmail(order, payment);

    } catch (error) {
        console.error('Error handling payment.failed:', error);
    }
};

/**
 * Handle order.paid event
 * Order is fully paid (all payments captured)
 */
const handleOrderPaid = async (razorpayOrder, payment) => {
    try {
        console.log(`✅ Order paid: ${razorpayOrder.id}`);
        
        // This event is similar to payment.captured
        // Can be used as a backup or for additional processing
        await handlePaymentCaptured(payment);

    } catch (error) {
        console.error('Error handling order.paid:', error);
    }
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmationEmail = async (order) => {
    try {
        const populatedOrder = await orderModel.findById(order._id)
            .populate('userId', 'name email')
            .populate('deliveryAddress')
            .populate('items.productId', 'name image price')
            .populate('items.bundleId', 'title image bundlePrice');

        const user = populatedOrder.userId;
        
        if (!user || !user.email) {
            console.error('❌ User email not found for order:', order.orderId);
            return;
        }

        const itemsHtml = populatedOrder.items.map(item => {
            const name = item.itemType === 'product' 
                ? (item.productId?.name || 'Product') 
                : (item.bundleId?.title || 'Bundle');
            
            return `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.unitPrice}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.itemTotal}</td>
                </tr>
            `;
        }).join('');

        await sendEmail({
            sendTo: user.email,
            subject: `Payment Confirmed - Order ${order.orderId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #4CAF50; color: white; padding: 15px; border-radius: 5px 5px 0 0; text-align: center;">
                        <h2 style="margin: 0;">✅ Payment Confirmed!</h2>
                    </div>
                    
                    <div style="padding: 20px;">
                        <p>Dear ${user.name},</p>
                        <p>Your payment has been successfully confirmed and your order is being processed.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #333;">Order Details:</h3>
                            <p><strong>Order ID:</strong> ${order.orderId}</p>
                            <p><strong>Payment ID:</strong> ${order.paymentId}</p>
                            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                            <p><strong>Order Status:</strong> ${order.orderStatus}</p>
                            <p><strong>Estimated Delivery:</strong> ${order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleDateString() : 'To be confirmed'}</p>
                        </div>

                        <h3>Items Ordered:</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <thead>
                                <tr style="background-color: #f5f5f5;">
                                    <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                                    <th style="padding: 8px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                                    <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                                    <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                            <p style="text-align: right; margin: 5px 0;"><strong>Subtotal:</strong> ₹${order.subTotalAmt}</p>
                            <p style="text-align: right; margin: 5px 0;"><strong>Delivery Charge:</strong> ₹${order.deliveryCharge || 0}</p>
                            <p style="text-align: right; font-size: 18px; margin: 10px 0;"><strong>Total Amount Paid:</strong> ₹${order.totalAmt}</p>
                        </div>

                        <p style="margin-top: 30px;">Thank you for shopping with us!</p>
                        <p style="color: #666; font-size: 12px; margin-top: 20px;">If you have any questions, please contact us at ${process.env.ADMIN_EMAIL}</p>
                    </div>
                </div>
            `
        });

        console.log(`📧 Confirmation email sent to ${user.email}`);

    } catch (error) {
        console.error('Error sending confirmation email:', error);
    }
};

/**
 * Send payment failure email
 */
const sendPaymentFailureEmail = async (order, payment) => {
    try {
        const populatedOrder = await orderModel.findById(order._id)
            .populate('userId', 'name email');

        const user = populatedOrder.userId;
        
        if (!user || !user.email) {
            console.error('❌ User email not found for order:', order.orderId);
            return;
        }

        await sendEmail({
            sendTo: user.email,
            subject: `Payment Failed - Order ${order.orderId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="background-color: #f44336; color: white; padding: 15px; border-radius: 5px 5px 0 0; text-align: center;">
                        <h2 style="margin: 0;">❌ Payment Failed</h2>
                    </div>
                    
                    <div style="padding: 20px;">
                        <p>Dear ${user.name},</p>
                        <p>Unfortunately, your payment for order <strong>${order.orderId}</strong> could not be processed.</p>
                        
                        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <h3 style="margin-top: 0; color: #856404;">Reason:</h3>
                            <p style="color: #856404;">${payment.error_description || 'Payment was declined or cancelled'}</p>
                        </div>

                        <p><strong>What you can do:</strong></p>
                        <ul>
                            <li>Try using a different payment method</li>
                            <li>Check if your card has sufficient balance</li>
                            <li>Contact your bank if the issue persists</li>
                            <li>Try placing the order again</li>
                        </ul>

                        <p>Your cart items are still saved. You can complete your purchase anytime.</p>

                        <p style="color: #666; font-size: 12px; margin-top: 30px;">If you need assistance, please contact us at ${process.env.ADMIN_EMAIL}</p>
                    </div>
                </div>
            `
        });

        console.log(`📧 Payment failure email sent to ${user.email}`);

    } catch (error) {
        console.error('Error sending failure email:', error);
    }
};

/**
 * Verify payment manually (frontend can call this after payment)
 * This is a backup verification method
 */
export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: true,
                message: 'Missing payment verification details'
            });
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: true,
                message: 'Invalid payment signature'
            });
        }

        // Update order
        const order = await orderModel.findOne({ orderId: orderId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: true,
                message: 'Order not found'
            });
        }

        // Fetch payment details from Razorpay
        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        order.paymentStatus = 'PAID';
        order.paymentId = razorpay_payment_id;
        order.paymentMethod = payment.method || 'Online Payment';
        order.orderStatus = 'ORDER PLACED';
        order.razorpayPaymentDetails = {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: payment.status,
            method: payment.method,
            capturedAt: new Date()
        };

        await order.save();

        // Send confirmation email
        await sendPaymentConfirmationEmail(order);

        return res.json({
            success: true,
            error: false,
            message: 'Payment verified successfully',
            data: {
                orderId: order.orderId,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus
            }
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            error: true,
            message: 'Payment verification failed',
            details: error.message
        });
    }
};

/**
 * Create Razorpay Order
 * This endpoint creates a Razorpay order before payment
 */
export const createRazorpayOrder = async (req, res) => {
    try {
        // Check if Razorpay credentials are configured
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('❌ Razorpay credentials not configured');
            return res.status(500).json({
                success: false,
                error: true,
                message: 'Payment gateway not configured. Please contact support.',
                details: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing'
            });
        }

        const { amount, currency = 'INR', orderId } = req.body;

        console.log('📝 Creating Razorpay order:', { amount, currency, orderId });

        if (!amount || !orderId) {
            return res.status(400).json({
                success: false,
                error: true,
                message: 'Amount and orderId are required'
            });
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: true,
                message: 'Invalid amount. Amount must be a positive number.'
            });
        }

        // Create Razorpay order
        const options = {
            amount: Math.round(amount * 100), // Amount in paise
            currency: currency,
            receipt: orderId,
            notes: {
                orderId: orderId
            }
        };

        console.log('🔧 Razorpay order options:', options);

        const razorpayOrder = await razorpay.orders.create(options);

        console.log(`✅ Razorpay order created: ${razorpayOrder.id} for order ${orderId}`);

        return res.json({
            success: true,
            error: false,
            data: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                orderId: orderId
            }
        });

    } catch (error) {
        console.error('❌ Error creating Razorpay order:', error);
        console.error('Error details:', {
            message: error.message,
            description: error.description,
            statusCode: error.statusCode,
            source: error.source
        });

        // Check for specific Razorpay errors
        let errorMessage = 'Failed to create payment order';
        if (error.statusCode === 400) {
            errorMessage = 'Invalid payment request. Please check your order details.';
        } else if (error.statusCode === 401) {
            errorMessage = 'Payment gateway authentication failed. Please contact support.';
        } else if (error.message.includes('key_id')) {
            errorMessage = 'Payment gateway configuration error. Please contact support.';
        }

        return res.status(500).json({
            success: false,
            error: true,
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export { razorpay };
