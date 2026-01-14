import orderCancellationModel from "../models/orderCancellation.model.js";
import cancellationPolicyModel from "../models/cancellationPolicy.model.js";
import orderModel from "../models/order.model.js";
import UserModel from "../models/users.model.js";
import ProductModel from "../models/product.model.js";
import BundleModel from "../models/bundles.js";
import sendEmail from "../config/sendEmail.js";
import { sendRefundInvoiceEmail } from "./payment.controller.js";
import fs from 'fs';
import mongoose from "mongoose";

// Helper function to determine if delivery charge should be refunded
// Now only returns the full delivery charge for total cancellations
const calculateDeliveryChargeRefund = (order, itemsToCancel, refundPercentage) => {
    // If refundPercentage is not provided, calculate it based on order timing
    if (refundPercentage === undefined) {
        const orderDate = order.orderDate || order.createdAt;
        if (orderDate) {
            const hoursSinceOrder = (new Date() - new Date(orderDate)) / (1000 * 60 * 60);
            refundPercentage = hoursSinceOrder <= 24 ? 90 : 75;
        } else {
            refundPercentage = 75; // Default fallback
        }
    }
    
    if (!order.deliveryCharge || order.deliveryCharge <= 0) {
        return 0; // No delivery charge to refund
    }

    if (!order.items || order.items.length === 0) {
        return 0; // No items in order
    }

    // Check if this is a full cancellation or the last remaining item
    const isFullCancellation = itemsToCancel.length === order.items.length;
    const isLastItemCancellation = order.items.length === 1 && itemsToCancel.length === 1;
    
    // Only refund delivery charge for full cancellations or last item cancellation
    if (isFullCancellation || isLastItemCancellation) {
        // Apply refund percentage to full delivery charge
        const deliveryRefund = (order.deliveryCharge * refundPercentage) / 100;
        
        console.log('📦 Delivery Charge Refund Calculation:', {
            deliveryCharge: order.deliveryCharge,
            refundPercentage,
            deliveryRefund,
            isFullCancellation,
            isLastItemCancellation
        });
        
        return Math.round(deliveryRefund * 100) / 100; // Round to 2 decimal places
    }
    
    // For partial cancellations with items remaining, no delivery charge is refunded
    console.log('📦 No delivery charge refund for partial cancellation with items remaining');
    return 0;
};

// Helper function to update all items in a full order cancellation
const updateFullOrderCancellation = async (orderId, cancellationId, refundPercentage) => {
    try {
        // Get the order with items to update each item status
        const fullOrder = await orderModel.findById(orderId);
        
        if (fullOrder) {
            // Update order status
            fullOrder.orderStatus = 'CANCELLED';
            fullOrder.paymentStatus = 'REFUND_PROCESSING';
            fullOrder.isFullOrderCancelled = true;
            
            // Update each item's status and prepare refundSummary
            const refundSummary = [];
            
            fullOrder.items.forEach(item => {
                // Update item status fields
                item.status = 'Cancelled';
                item.cancelApproved = true;
                item.refundStatus = 'Processing';
                item.refundAmount = (item.itemTotal * refundPercentage / 100);
                item.cancellationId = cancellationId;
                
                // Add to refundSummary
                refundSummary.push({
                    itemId: item._id,
                    amount: item.refundAmount,
                    status: 'Processing'
                });
            });
            
            fullOrder.refundSummary = refundSummary;
            await fullOrder.save();
        } else {
            // Fallback if order not found
            await orderModel.findByIdAndUpdate(orderId, {
                orderStatus: 'CANCELLED',
                paymentStatus: 'REFUND_PROCESSING',
                isFullOrderCancelled: true
            });
        }
    } catch (error) {
        console.error("Error updating full order cancellation:", error);
        throw error;
    }
};

// Comprehensive Order Details Controller - Get complete order details with properly populated data
export const getComprehensiveOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Invalid order ID format"
            });
        }
        
        // Find the order with populated address
        const order = await orderModel.findById(orderId)
            .populate('deliveryAddress')
            .lean();
            
        if (!order) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Order not found"
            });
        }
        
        // Check if user has permission to view this order
        const userId = req.userId;
        const isAdmin = req.isAdmin;
        
        if (!isAdmin && order.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: true,
                message: "You don't have permission to view this order"
            });
        }
        
        // Enhance each item with complete details
        const enhancedItems = await Promise.all(order.items.map(async (item) => {
            try {
                if (item.itemType === 'product' && item.productId) {
                    // If product details are incomplete, fetch from database
                    if (!item.productDetails || !item.productDetails.name) {
                        const product = await ProductModel.findById(item.productId).lean();
                        if (product) {
                            item.productDetails = {
                                ...product,
                                _id: product._id.toString()
                            };
                        }
                    }
                    
                    // Ensure size-specific pricing is correctly set
                    if (item.size) {
                        // If product has size-specific pricing, make sure it's included
                        const product = await ProductModel.findById(item.productId).lean();
                        if (product && product.sizePricing && product.sizePricing[item.size]) {
                            // If item doesn't have sizeAdjustedPrice, set it
                            if (item.sizeAdjustedPrice === undefined) {
                                item.sizeAdjustedPrice = product.sizePricing[item.size];
                                console.log(`Added missing sizeAdjustedPrice ${product.sizePricing[item.size]} for product ${product.name} size ${item.size}`);
                            }
                            
                            // Make sure productDetails has the size pricing
                            if (!item.productDetails.sizePricing) {
                                item.productDetails.sizePricing = {};
                            }
                            item.productDetails.sizePricing[item.size] = product.sizePricing[item.size];
                        }
                    }
                    
                    // Ensure unitPrice is correctly set
                    if (item.unitPrice === undefined || item.unitPrice === 0) {
                        if (item.sizeAdjustedPrice !== undefined && item.sizeAdjustedPrice > 0) {
                            item.unitPrice = Number(item.sizeAdjustedPrice);
                        } else if (item.productDetails?.finalPrice !== undefined && item.productDetails.finalPrice > 0) {
                            item.unitPrice = Number(item.productDetails.finalPrice);
                        } else if (item.productDetails?.price !== undefined && item.productDetails.price > 0) {
                            const price = item.productDetails.price;
                            const discount = item.productDetails?.discount || 0;
                            item.unitPrice = discount > 0 ? price * (1 - discount/100) : price;
                        } else {
                            // Final fallback - try to get price from the product in database
                            const product = await ProductModel.findById(item.productId).lean();
                            if (product) {
                                if (item.size && product.sizePricing && product.sizePricing[item.size]) {
                                    item.unitPrice = product.sizePricing[item.size];
                                    item.sizeAdjustedPrice = product.sizePricing[item.size];
                                } else {
                                    const discount = product.discount || 0;
                                    item.unitPrice = discount > 0 ? product.price * (1 - discount/100) : product.price;
                                }
                                
                                // Update productDetails with complete info
                                item.productDetails = {
                                    ...item.productDetails,
                                    ...product,
                                    _id: product._id.toString()
                                };
                            }
                        }
                        console.log(`Set missing unitPrice to ${item.unitPrice} for product ${item.productDetails?.name || 'unknown'}`);
                    }
                    
                } else if (item.itemType === 'bundle' && item.bundleId) {
                    // If bundle details are incomplete, fetch from database
                    if (!item.bundleDetails || !item.bundleDetails.title) {
                        const bundle = await BundleModel.findById(item.bundleId).lean();
                        if (bundle) {
                            item.bundleDetails = {
                                ...bundle,
                                _id: bundle._id.toString()
                            };
                        }
                    }
                    
                    // Ensure unitPrice is set for bundle
                    if (item.unitPrice === undefined || item.unitPrice === 0) {
                        if (item.bundleDetails?.bundlePrice !== undefined && item.bundleDetails.bundlePrice > 0) {
                            item.unitPrice = item.bundleDetails.bundlePrice;
                        } else {
                            // Fetch bundle price from database as fallback
                            const bundle = await BundleModel.findById(item.bundleId).lean();
                            if (bundle && bundle.bundlePrice) {
                                item.unitPrice = bundle.bundlePrice;
                                // Update bundleDetails
                                item.bundleDetails = {
                                    ...item.bundleDetails,
                                    ...bundle,
                                    _id: bundle._id.toString()
                                };
                            }
                        }
                        console.log(`Set missing unitPrice to ${item.unitPrice} for bundle ${item.bundleDetails?.title || 'unknown'}`);
                    }
                }
                return item;
            } catch (error) {
                console.error(`Error processing item ${item._id}:`, error);
                return item; // Return original item if enhancement fails
            }
        }));
        
        // Update order with enhanced items
        order.items = enhancedItems;
        
        // Get user information
        const user = await UserModel.findById(order.userId).select('name email phone').lean();
        order.user = user;
        
        // Check if order has any cancellation requests
        const cancellationRequest = await orderCancellationModel.findOne({
            orderId: orderId,
            isActive: true
        }).sort({ requestDate: -1 }).lean();
        
        // Add cancellation info to response if exists
        if (cancellationRequest) {
            order.cancellationRequest = cancellationRequest;
        }
        
        return res.json({
            success: true,
            error: false,
            message: "Order details retrieved successfully",
            data: order
        });
        
    } catch (error) {
        console.error("Error fetching comprehensive order details:", error);
        return res.status(500).json({
            success: false,
            error: true,
            message: "Error retrieving order details",
            details: error.message
        });
    }
};

// User requests order cancellation
export const requestOrderCancellation = async (req, res) => {
    try {
        const userId = req.userId;
        const { orderId, reason, additionalReason, pricingInformation } = req.body;

        console.log('Cancellation request data:', {
            userId,
            orderId,
            reason,
            additionalReason,
            pricingInformation,
            body: req.body
        });

        // Validate required fields
        if (!orderId || !reason) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Order ID and reason are required"
            });
        }

        // Validate order exists and belongs to user
        // Support both MongoDB _id and custom orderId
        const order = await orderModel.findOne({ 
            $or: [
                { _id: orderId },
                { orderId: orderId }
            ],
            userId: userId 
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Order not found or doesn't belong to you"
            });
        }

        // Check if order can be cancelled based on status
        const nonCancellableStatuses = ['OUT FOR DELIVERY', 'DELIVERED', 'CANCELLED'];
        if (nonCancellableStatuses.includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                error: true,
                message: `Cannot cancel order with status: ${order.orderStatus}`
            });
        }
        
        // Check if payment is online and paid, or if it's a partial refund processing order
        // Allow cancellation for:
        // 1. Paid online orders (original case)
        // 2. Orders with partial refund processing (when some items were already cancelled)
        // 3. Orders with successful refund (when previous partial refunds were completed)
        // 4. Pending payment orders (payment not yet confirmed via webhook)
        const allowedPaymentStatuses = ['PAID', 'PENDING', 'PARTIAL_REFUND_PROCESSING', 'REFUND_SUCCESSFUL'];
        
        // Log payment details for debugging
        console.log('Payment validation:', {
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            allowedStatuses: allowedPaymentStatuses
        });
        
        // Check if payment method is online (case-insensitive check)
        const isOnlinePayment = order.paymentMethod && 
            (order.paymentMethod.toLowerCase().includes('online') || 
             order.paymentMethod.toLowerCase().includes('razorpay') ||
             order.paymentMethod.toLowerCase().includes('card') ||
             order.paymentMethod.toLowerCase().includes('upi'));
        
        if (!isOnlinePayment || !allowedPaymentStatuses.includes(order.paymentStatus)) {
            return res.status(400).json({
                success: false,
                error: true,
                message: `Only paid online orders can be cancelled. Payment method: ${order.paymentMethod}, Status: ${order.paymentStatus}`
            });
        }

        // Check if cancellation request already exists with status PENDING
        // We only block if there's a PENDING request, allowing new requests after previous ones were APPROVED
        const existingPendingRequest = await orderCancellationModel.findOne({
            orderId: order._id, // Use the MongoDB _id from the found order
            status: 'PENDING'
        });

        if (existingPendingRequest) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "A pending cancellation request already exists for this order"
            });
        }
        
        // Check if there are any remaining active items that can be cancelled
        const activeItems = order.items.filter(item => 
            item.status !== 'Cancelled' && !item.cancelApproved
        );
        
        if (activeItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "No active items left to cancel in this order"
            });
        }

        // Get current policy for refund calculation (legacy)
        const policy = await cancellationPolicyModel.findOne({ isActive: true });
        
        // Check if cancellation is past estimated delivery date
        const now = new Date();
        const wasPastDeliveryDate = order.estimatedDeliveryDate && 
            now > new Date(order.estimatedDeliveryDate) && 
            !order.actualDeliveryDate;
            
        // Prepare cancellation request context for refund calculation
        const cancellationContext = {
            requestDate: now,
            deliveryInfo: {
                estimatedDeliveryDate: order.estimatedDeliveryDate,
                actualDeliveryDate: order.actualDeliveryDate,
                wasPastDeliveryDate: wasPastDeliveryDate
            },
            createdAt: now
        };

        // Calculate refund amount using the dynamic RefundPolicyService when possible
        let expectedRefundAmount;
        let refundPercentage;
        let refundCalculation = null;
        
        // Priority 1: Use frontend provided calculation if available
        if (pricingInformation?.calculatedRefundAmount !== undefined) {
            expectedRefundAmount = pricingInformation.calculatedRefundAmount;
            refundPercentage = pricingInformation?.refundPercentage || 75;
            console.log('✅ Using pricing information refund amount:', expectedRefundAmount);
        } else {
            try {
                // Get customer information for loyalty bonuses
                const user = await UserModel.findById(userId);
                const customerInfo = user ? {
                    isVip: user.role === 'VIP' || user.membershipTier === 'VIP',
                    membershipTier: user.membershipTier || 'REGULAR',
                    orderHistory: user.orderHistory || []
                } : null;
                
                // Import RefundPolicyService for dynamic calculation
                const { RefundPolicyService } = await import('../utils/RefundPolicyService.js');
                
                // Prepare order data for refund calculation
                const orderForCalculation = {
                    totalAmt: order.totalAmt,
                    subTotalAmt: order.subTotalAmt,
                    deliveryCharge: order.deliveryCharge,
                    orderDate: order.orderDate || order.createdAt
                };
                
                // Use enhanced pricing if available
                if (pricingInformation?.totalAmountCustomerPaid !== undefined) {
                    orderForCalculation.totalAmt = pricingInformation.totalAmountCustomerPaid + (order.deliveryCharge || 0);
                    orderForCalculation.subTotalAmt = pricingInformation.totalAmountCustomerPaid;
                }
                
                // Calculate refund using the enhanced policy service
                refundCalculation = RefundPolicyService.calculateRefundAmount(
                    orderForCalculation,
                    cancellationContext,
                    null, // No custom percentage
                    customerInfo
                );
                
                expectedRefundAmount = refundCalculation.refundAmount;
                refundPercentage = refundCalculation.refundPercentage;
                
                console.log('💰 Dynamic Refund Calculation:', {
                    baseAmount: refundCalculation.originalAmount,
                    refundPercentage: refundCalculation.refundPercentage,
                    finalRefundAmount: refundCalculation.refundAmount,
                    cancellationTiming: refundCalculation.cancellationTiming,
                    penalties: refundCalculation.penalties,
                    bonuses: refundCalculation.bonuses
                });
                
            } catch (calcError) {
                // Fallback to legacy calculation if dynamic calculation fails
                console.error('Error using RefundPolicyService:', calcError);
                
                refundPercentage = pricingInformation?.refundPercentage || 75;
                
                if (pricingInformation?.totalAmountCustomerPaid !== undefined) {
                    // Include delivery charges in the total amount customer paid
                    const totalWithDelivery = pricingInformation.totalAmountCustomerPaid + (order.deliveryCharge || 0);
                    expectedRefundAmount = (totalWithDelivery * refundPercentage) / 100;
                } else {
                    // Fallback to original calculation - includes delivery charges in totalAmt
                    expectedRefundAmount = (order.totalAmt * refundPercentage) / 100;
                }
                
                console.log('⚠️ Using fallback refund calculation (includes delivery):', {
                    orderTotal: order.totalAmt,
                    deliveryCharge: order.deliveryCharge || 0,
                    refundPercentage,
                    expectedRefundAmount
                });
            }
        }

        // Create cancellation request with delivery information and pricing data
        const cancellationRequest = new orderCancellationModel({
            orderId,
            userId,
            reason,
            additionalReason,
            pricingInformation: pricingInformation || null, // Store pricing information from frontend
            refundDetails: {
                enhancedRefundData: refundCalculation ? {
                    calculationMethod: 'RefundPolicyService',
                    cancellationTiming: refundCalculation.cancellationTiming,
                    daysSinceOrder: refundCalculation.daysSinceOrder,
                    penalties: refundCalculation.penalties,
                    bonuses: refundCalculation.bonuses
                } : null
            },
            deliveryInfo: {
                estimatedDeliveryDate: order.estimatedDeliveryDate,
                actualDeliveryDate: order.actualDeliveryDate,
                deliveryNotes: order.deliveryNotes,
                deliveryCharge: order.deliveryCharge || 0, // Store delivery charge at time of cancellation
                wasPastDeliveryDate
            },
            adminResponse: {
                refundPercentage,
                refundAmount: expectedRefundAmount // Store calculated refund amount
            }
        });

        console.log("About to save cancellation request:", cancellationRequest);
        const savedRequest = await cancellationRequest.save();
        console.log("Cancellation request saved successfully:", savedRequest._id);

        // Get user details for email
        const user = await UserModel.findById(userId);
        console.log("User found for email:", user.name, user.email);

        // Send confirmation email to user
        if (user.email) {
            await sendEmail({
                sendTo: user.email,
                subject: "Order Cancellation Request Received",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Order Cancellation Request Received</h2>
                        <p>Dear ${user.name},</p>
                        <p>We have received your cancellation request for order <strong>#${order.orderId}</strong>.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3>Request Details:</h3>
                            <p><strong>Order ID:</strong> ${order.orderId}</p>
                            <p><strong>Reason:</strong> ${reason}</p>
                            <p><strong>Request Date:</strong> ${new Date().toLocaleDateString()}</p>
                            ${order.estimatedDeliveryDate ? `<p><strong>Estimated Delivery Date:</strong> ${new Date(order.estimatedDeliveryDate).toLocaleDateString()}</p>` : ''}
                            
                            <div style="border-top: 1px solid #dee2e6; margin: 10px 0; padding-top: 10px;">
                                <h4 style="margin-top: 0;">Refund Details:</h4>
                                <p><strong>Expected Refund:</strong> ₹${expectedRefundAmount.toFixed(2)} (${refundPercentage}% of total order)</p>
                                ${order.deliveryCharge && order.deliveryCharge > 0 ? `<p><strong>Delivery Charge:</strong> ₹${order.deliveryCharge.toFixed(2)} (included in refund calculation)</p>` : ''}
                                ${pricingInformation?.totalCustomerSavings ? `<p><strong>Your Savings:</strong> ₹${pricingInformation.totalCustomerSavings.toFixed(2)} from discounts</p>` : ''}
                                
                                ${refundCalculation ? `
                                <div style="margin-top: 10px; padding: 10px; background-color: #e9ecef; border-radius: 4px;">
                                    <p><strong>Cancellation Timing:</strong> ${
                                        refundCalculation.cancellationTiming === 'EARLY' ? 'Early (within 2 days) - 90% base refund' : 
                                        refundCalculation.cancellationTiming === 'STANDARD' ? 'Standard (3-7 days) - 75% base refund' : 
                                        'Late (after 7 days) - 50% base refund'
                                    }</p>
                                    
                                    ${refundCalculation.bonuses?.totalBonus > 0 ? `
                                    <p style="color: #28a745;"><strong>Customer Loyalty Bonus:</strong> +${refundCalculation.bonuses.totalBonus}%</p>
                                    ${refundCalculation.bonuses.reasons?.map(reason => 
                                        `<p style="color: #28a745; margin-left: 15px; font-size: 0.9em;">• ${reason}</p>`
                                    ).join('') || ''}
                                    ` : ''}
                                    
                                    ${refundCalculation.penalties?.totalPenalty > 0 ? `
                                    <p style="color: #856404;"><strong>Applied Penalties:</strong> -${refundCalculation.penalties.totalPenalty}%</p>
                                    ${refundCalculation.penalties.reasons?.map(reason => 
                                        `<p style="color: #856404; margin-left: 15px; font-size: 0.9em;">• ${reason}</p>`
                                    ).join('') || ''}
                                    ` : ''}
                                </div>
                                ` : wasPastDeliveryDate ? '<p style="color: #dc3545;"><strong>Note:</strong> Cancellation requested after estimated delivery date</p>' : ''}
                            </div>
                        </div>
                        
                        <p><strong>What happens next?</strong></p>
                        <ul>
                            <li>Our team will review your request within 48 hours</li>
                            <li>You will receive an email with the decision</li>
                            <li>If approved, refund will be processed within 5-7 business days</li>
                        </ul>
                        
                        <p>Thank you for your patience.</p>
                        <p>Best regards,<br>casualclothings Team</p>
                    </div>
                `
            });
        }

        // Prepare enhanced response with refund calculation details
        const responseData = {
            success: true,
            error: false,
            message: "Cancellation request submitted successfully",
            data: {
                requestId: cancellationRequest._id,
                expectedRefund: expectedRefundAmount.toFixed(2),
                refundPercentage,
                pricingUsed: pricingInformation ? 'Enhanced pricing from frontend' : 'Dynamic calculation'
            }
        };
        
        // Add enhanced refund calculation details if available
        if (refundCalculation) {
            responseData.data.refundCalculation = {
                cancellationTiming: refundCalculation.cancellationTiming,
                daysSinceOrder: refundCalculation.daysSinceOrder,
                penalties: refundCalculation.penalties,
                bonuses: refundCalculation.bonuses,
                originalAmount: refundCalculation.originalAmount,
                finalRefundAmount: refundCalculation.refundAmount
            };
        }
        
        res.status(200).json(responseData);

    } catch (error) {
        console.error("Error in requestOrderCancellation:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// User function to get their own cancellation requests
export const getUserCancellationRequests = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware

        const requests = await orderCancellationModel.find({
            userId: userId
        })
        .populate({
            path: 'orderId',
            select: 'orderId totalAmt orderDate orderStatus paymentMethod paymentStatus items subTotalAmt totalQuantity orderQuantity productDetails',
            populate: [
                {
                    path: 'items.productId',
                    select: 'name title image price'
                },
                {
                    path: 'items.bundleId',
                    select: 'title name image price'
                }
            ]
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            error: false,
            message: "User cancellation requests retrieved successfully",
            data: requests
        });

    } catch (error) {
        console.error("Error in getUserCancellationRequests:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// Admin function to get all cancellation requests
export const getCancellationRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'all' } = req.query;
        
        const filter = { isActive: true };
        if (status !== 'all') {
            filter.status = status;
        }

        const requests = await orderCancellationModel.find(filter)
            .populate({
                path: 'orderId',
                select: 'orderId totalAmt orderDate orderStatus paymentMethod paymentStatus items subTotalAmt totalQuantity orderQuantity productDetails',
                populate: [
                    {
                        path: 'items.productId',
                        select: 'name title image price'
                    },
                    {
                        path: 'items.bundleId',
                        select: 'title name image price'
                    }
                ]
            })
            .populate('userId', 'name email')
            .populate('adminResponse.processedBy', 'name')
            .sort({ requestDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await orderCancellationModel.countDocuments(filter);

        res.status(200).json({
            success: true,
            error: false,
            data: {
                requests,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRequests: total
            }
        });

    } catch (error) {
        console.error("Error in getCancellationRequests:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// Admin processes cancellation request (approve/reject)
export const processCancellationRequest = async (req, res) => {
    try {
        const adminId = req.userId;
        const { requestId, action, adminComments, customRefundPercentage, calculatedRefundAmount, calculatedTotalValue, refundData } = req.body;

        // Validate required fields
        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Request ID is required"
            });
        }

        if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Invalid action. Must be APPROVED or REJECTED"
            });
        }

        const cancellationRequest = await orderCancellationModel.findById(requestId)
            .populate({
                path: 'orderId',
                populate: [
                    {
                        path: 'items.productId',
                        select: 'name title image price'
                    },
                    {
                        path: 'items.bundleId',
                        select: 'title name image price'
                    }
                ]
            })
            .populate('userId');

        if (!cancellationRequest) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Cancellation request not found"
            });
        }

        if (cancellationRequest.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Request has already been processed"
            });
        }

        // Calculate refund amount using the enhanced RefundPolicyService
        const order = cancellationRequest.orderId;
        
        // Priority 1: Use frontend-calculated refund amount if available (includes discount pricing)
        let refundAmount = 0;
        let baseAmount = 0;
        let finalRefundPercentage = 0;
        let refundCalculation = null;
        
        if (action === 'APPROVED' && calculatedRefundAmount !== undefined && calculatedTotalValue !== undefined) {
            // Use the calculated amounts from frontend that incorporate discount pricing
            refundAmount = calculatedRefundAmount;
            baseAmount = calculatedTotalValue;
            
            // Calculate actual refund percentage based on the frontend calculated amounts
            if (calculatedTotalValue > 0) {
                finalRefundPercentage = Math.round((calculatedRefundAmount / calculatedTotalValue) * 100);
            } else {
                finalRefundPercentage = customRefundPercentage || cancellationRequest.adminResponse.refundPercentage || 75;
            }
            
            console.log('💰 Using Frontend-Calculated Refund:', {
                calculatedRefundAmount: refundAmount,
                calculatedTotalValue: baseAmount,
                calculatedRefundPercentage: finalRefundPercentage,
                customRefundPercentage: customRefundPercentage,
                basedOnDiscountedPricing: refundData?.basedOnDiscountedPricing || false
            });
        } else if (action === 'APPROVED') {
            // Get customer information for loyalty bonuses
            const customer = cancellationRequest.userId;
            const customerInfo = customer ? {
                isVip: customer.role === 'VIP' || customer.membershipTier === 'VIP',
                membershipTier: customer.membershipTier || 'REGULAR',
                orderHistory: customer.orderHistory || []
            } : null;
            
            // Use the enhanced RefundPolicyService for dynamic refund calculation
            // Import RefundPolicyService
            const { RefundPolicyService } = await import('../utils/RefundPolicyService.js');
            
            // Prepare order data for refund calculation
            const orderForCalculation = {
                totalAmt: order.totalAmt,
                subTotalAmt: order.subTotalAmt,
                deliveryCharge: order.deliveryCharge,
                orderDate: order.orderDate || order.createdAt
            };
            
            // Use pricing information if available for more accurate calculation
            if (cancellationRequest.pricingInformation?.totalAmountCustomerPaid) {
                orderForCalculation.totalAmt = cancellationRequest.pricingInformation.totalAmountCustomerPaid + (order.deliveryCharge || 0);
                orderForCalculation.subTotalAmt = cancellationRequest.pricingInformation.totalAmountCustomerPaid;
                
                console.log('✅ Using enhanced pricing for refund calculation:', {
                    customerPaid: cancellationRequest.pricingInformation.totalAmountCustomerPaid,
                    deliveryCharge: order.deliveryCharge || 0,
                    totalForCalculation: orderForCalculation.totalAmt
                });
            }
            
            // Calculate refund using the enhanced policy service
            refundCalculation = RefundPolicyService.calculateRefundAmount(
                orderForCalculation, 
                cancellationRequest, 
                customRefundPercentage,
                customerInfo
            );
            
            refundAmount = refundCalculation.refundAmount;
            baseAmount = refundCalculation.originalAmount;
            finalRefundPercentage = refundCalculation.refundPercentage;
            
            console.log('💰 Dynamic Refund Calculation:', {
                baseAmount: baseAmount,
                refundPercentage: finalRefundPercentage,
                finalRefundAmount: refundAmount,
                cancellationTiming: refundCalculation.cancellationTiming,
                penalties: refundCalculation.penalties,
                bonuses: refundCalculation.bonuses
            });
        } else {
            // If rejected, no refund
            refundAmount = 0;
            baseAmount = order.totalAmt;
            finalRefundPercentage = 0;
            
            // This block is no longer needed as it's handled above
        }

        // Update cancellation request
        cancellationRequest.status = action;
        cancellationRequest.adminResponse.processedBy = adminId;
        cancellationRequest.adminResponse.processedDate = new Date();
        cancellationRequest.adminResponse.adminComments = adminComments;
        cancellationRequest.adminResponse.refundAmount = refundAmount;
        cancellationRequest.adminResponse.refundPercentage = finalRefundPercentage;
        
        // Store enhanced refund data
        // First priority: Frontend data if provided
        if (refundData) {
            cancellationRequest.refundDetails.enhancedRefundData = {
                ...refundData,
                processedAt: new Date(),
                processedBy: adminId
            };
            
            console.log('📊 Stored frontend enhanced refund data:', cancellationRequest.refundDetails.enhancedRefundData);
        } 
        // Second priority: RefundPolicyService calculation results
        else if (refundCalculation) {
            cancellationRequest.refundDetails.enhancedRefundData = {
                calculationMethod: 'RefundPolicyService',
                cancellationTiming: refundCalculation.cancellationTiming,
                daysSinceOrder: refundCalculation.daysSinceOrder,
                penalties: refundCalculation.penalties,
                bonuses: refundCalculation.bonuses,
                processedAt: new Date(),
                processedBy: adminId
            };
            
            console.log('📊 Stored policy-based refund data:', cancellationRequest.refundDetails.enhancedRefundData);
        }

        if (action === 'APPROVED') {
            cancellationRequest.refundDetails.refundStatus = 'PROCESSING';
            
            // Handle full vs partial cancellation differently
            if (cancellationRequest.cancellationType === 'PARTIAL_ITEMS') {
                // For partial cancellations, update only the specific items
                const order = cancellationRequest.orderId;
                const cancelledItemIds = cancellationRequest.itemsToCancel.map(item => item.itemId.toString());
                
                // Update only the cancelled items status with proper refund amounts
                order.items.forEach(item => {
                    if (cancelledItemIds.includes(item._id.toString())) {
                        // Find the corresponding cancelled item to get the correct refund amount
                        const cancelledItem = cancellationRequest.itemsToCancel.find(
                            cancelItem => cancelItem.itemId.toString() === item._id.toString()
                        );
                        
                        item.status = 'Cancelled';
                        item.cancelApproved = true;
                        item.refundStatus = 'Processing';
                        
                        // Use the specific refund amount from frontend calculation if available
                        if (cancelledItem && cancelledItem.refundAmount !== undefined) {
                            item.refundAmount = cancelledItem.refundAmount;
                            console.log(`✅ Using frontend calculated refund amount for item ${item._id}: ₹${cancelledItem.refundAmount}`);
                        } else {
                            // Fallback to percentage-based calculation
                            item.refundAmount = (item.itemTotal * finalRefundPercentage / 100);
                            console.log(`⚠️ Using percentage-based refund calculation for item ${item._id}: ₹${item.refundAmount} (${finalRefundPercentage}% of ₹${item.itemTotal})`);
                        }
                        
                        item.cancellationId = cancellationRequest._id;
                    }
                });
                
                // Update order status to 'PARTIALLY_CANCELLED' if not all items are cancelled
                const totalItems = order.items.length;
                const cancelledItems = order.items.filter(item => item.status === 'Cancelled' || item.cancelApproved).length;
                
                if (cancelledItems === totalItems) {
                    // All items cancelled - treat as full cancellation
                    order.orderStatus = 'CANCELLED';
                    order.paymentStatus = 'REFUND_PROCESSING';
                    order.isFullOrderCancelled = true;
                } else {
                    // Partial cancellation
                    order.orderStatus = 'PARTIALLY_CANCELLED';
                    order.paymentStatus = 'PARTIAL_REFUND_PROCESSING';
                }
                
                await order.save();
                console.log(`✅ Partial item cancellation approved - Order: ${order.orderId}, Items cancelled: ${cancelledItems}/${totalItems}, Refund: ₹${refundAmount}`);
            } else {
                // Full order cancellation
                await updateFullOrderCancellation(order._id, cancellationRequest._id, finalRefundPercentage);
                console.log(`✅ Full order cancellation approved - Order: ${order.orderId}, Refund: ₹${refundAmount}`);
            }
        }

        await cancellationRequest.save();
        
        console.log(`📋 Cancellation Request ${action}:`, {
            requestId: cancellationRequest._id,
            orderNumber: order.orderId,
            action: action,
            refundAmount: action === 'APPROVED' ? refundAmount : 0,
            refundPercentage: finalRefundPercentage,
            adminId: adminId,
            processedAt: new Date().toISOString()
        });

        // Send email to user
        const user = cancellationRequest.userId;
        if (user.email) {
            const isPartialCancellation = cancellationRequest.cancellationType === 'PARTIAL_ITEMS';
            const emailSubject = action === 'APPROVED' 
                ? `${isPartialCancellation ? 'Partial Order' : 'Order'} Cancellation Approved - Refund Processing`
                : `${isPartialCancellation ? 'Partial Order' : 'Order'} Cancellation Request Rejected`;

            const emailContent = action === 'APPROVED' 
                ? `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #28a745;">${isPartialCancellation ? 'Partial Order' : 'Order'} Cancellation Approved</h2>
                        <p>Dear ${user.name},</p>
                        <p>Your ${isPartialCancellation ? 'partial item' : 'full order'} cancellation request for order <strong>#${order.orderId}</strong> has been approved.</p>
                        
                        ${isPartialCancellation ? `
                            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                                <h4>Cancelled Items:</h4>
                                <ul>
                                    ${cancellationRequest.itemsToCancel.map(item => {
                                        const orderItem = order.items.find(oi => oi._id.toString() === item.itemId.toString());
                                        const itemName = orderItem?.productId?.name || orderItem?.bundleId?.title || 'Item';
                                        return `<li><strong>${itemName}</strong> - Quantity: ${item.quantity}</li>`;
                                    }).join('')}
                                </ul>
                                <p style="color: #856404;"><strong>Note:</strong> Other items in your order will continue to be processed normally.</p>
                            </div>
                        ` : ''}
                        
                        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                            <h3>Refund Details:</h3>
                            <p><strong>Refund Amount:</strong> ₹${refundAmount.toFixed(2)}${!isPartialCancellation && order.deliveryCharge > 0 ? ' (includes delivery charges)' : ''}</p>
                            <p><strong>Refund Percentage:</strong> ${finalRefundPercentage}%</p>
                            ${order.deliveryCharge && order.deliveryCharge > 0 ? `<p><strong>Original Delivery Charge:</strong> ₹${order.deliveryCharge.toFixed(2)}</p>` : ''}
                            
                            ${cancellationRequest.refundDetails?.enhancedRefundData?.cancellationTiming ? `
                                <div style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                                    <p><strong>Cancellation Timing:</strong> ${cancellationRequest.refundDetails.enhancedRefundData.cancellationTiming === 'EARLY' ? 'Early (within 2 days)' : 
                                                                             cancellationRequest.refundDetails.enhancedRefundData.cancellationTiming === 'STANDARD' ? 'Standard (3-7 days)' : 
                                                                             'Late (after 7 days)'}</p>
                                    ${cancellationRequest.refundDetails.enhancedRefundData.bonuses?.totalBonus > 0 ? `
                                        <p style="color: #28a745;"><strong>Customer Loyalty Bonus:</strong> +${cancellationRequest.refundDetails.enhancedRefundData.bonuses.totalBonus}%</p>
                                        ${cancellationRequest.refundDetails.enhancedRefundData.bonuses.reasons?.map(reason => 
                                            `<p style="color: #28a745; margin-left: 15px; font-size: 0.9em;">• ${reason}</p>`
                                        ).join('') || ''}
                                    ` : ''}
                                    
                                    ${cancellationRequest.refundDetails.enhancedRefundData.penalties?.totalPenalty > 0 ? `
                                        <p style="color: #856404;"><strong>Applied Penalties:</strong> -${cancellationRequest.refundDetails.enhancedRefundData.penalties.totalPenalty}%</p>
                                        ${cancellationRequest.refundDetails.enhancedRefundData.penalties.reasons?.map(reason => 
                                            `<p style="color: #856404; margin-left: 15px; font-size: 0.9em;">• ${reason}</p>`
                                        ).join('') || ''}
                                    ` : ''}
                                </div>
                            ` : 
                            cancellationRequest.deliveryInfo?.wasPastDeliveryDate ? 
                                '<p style="color: #856404;"><strong>Note:</strong> Refund percentage adjusted due to late cancellation</p>' : 
                            cancellationRequest.deliveryInfo?.actualDeliveryDate ? 
                                '<p style="color: #856404;"><strong>Note:</strong> Refund percentage adjusted as order was already delivered</p>' : ''}
                            
                            <p><strong>Processing Time:</strong> 5-7 business days</p>
                            <p><strong>Refund Method:</strong> Original payment method</p>
                        </div>
                        
                        ${adminComments ? `<p><strong>Admin Comments:</strong> ${adminComments}</p>` : ''}
                        
                        <p>Your refund will be processed within 5-7 business days and will be credited to your original payment method.</p>
                        
                        <p>Thank you for your understanding.</p>
                        <p>Best regards,<br>casualclothings Team</p>
                    </div>
                `
                : `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc3545;">Order Cancellation Request Rejected</h2>
                        <p>Dear ${user.name},</p>
                        <p>We regret to inform you that your cancellation request for order <strong>#${order.orderId}</strong> has been rejected.</p>
                        
                        ${adminComments ? `
                            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                                <p><strong>Reason:</strong> ${adminComments}</p>
                            </div>
                        ` : ''}
                        
                        <p>Your order will continue to be processed as normal. If you have any concerns, please contact our customer support team.</p>
                        
                        <p>Thank you for your understanding.</p>
                        <p>Best regards,<br>casualclothings Team</p>
                    </div>
                `;

            await sendEmail({
                sendTo: user.email,
                subject: emailSubject,
                html: emailContent
            });
        }

        // Prepare enhanced response with refund calculation details
        const responseData = {
            success: true,
            error: false,
            message: `Cancellation request ${action.toLowerCase()} successfully`,
            data: {
                status: action,
                refundAmount: refundAmount,
                refundPercentage: finalRefundPercentage,
            }
        };
        
        // Add enhanced refund calculation details if available
        if (cancellationRequest.refundDetails?.enhancedRefundData) {
            responseData.data.refundCalculation = {
                ...cancellationRequest.refundDetails.enhancedRefundData,
                originalAmount: baseAmount,
                finalRefundAmount: refundAmount
            };
        }
        
        res.status(200).json(responseData);

    } catch (error) {
        console.error("Error in processCancellationRequest:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// Admin completes refund process
export const completeRefund = async (req, res) => {
    try {
        const adminId = req.userId;
        const { requestId, transactionId, adminComments } = req.body;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Request ID is required"
            });
        }

        const cancellationRequest = await orderCancellationModel.findById(requestId)
            .populate('orderId')
            .populate('userId');

        if (!cancellationRequest) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Cancellation request not found"
            });
        }

        // Check if the request is in APPROVED status
        if (cancellationRequest.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Only approved cancellation requests can be refunded"
            });
        }

        // Check if refund is already processed
        if (cancellationRequest.refundDetails.refundStatus === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Refund has already been processed"
            });
        }

        // Update cancellation request with refund details
        cancellationRequest.refundDetails.refundId = transactionId || `REF-${Date.now()}`;
        cancellationRequest.refundDetails.refundDate = new Date();
        cancellationRequest.refundDetails.refundStatus = 'COMPLETED';
        cancellationRequest.adminResponse.adminComments = adminComments || cancellationRequest.adminResponse.adminComments;
        
        await cancellationRequest.save();

        // Update order status and items' refund status
        const order = await orderModel.findById(cancellationRequest.orderId._id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Order not found"
            });
        }
        
        // Update main order status
        order.paymentStatus = 'REFUND_SUCCESSFUL';
        order.refundDetails = {
            refundId: cancellationRequest.refundDetails.refundId,
            refundAmount: cancellationRequest.adminResponse.refundAmount,
            refundPercentage: cancellationRequest.adminResponse.refundPercentage,
            refundDate: new Date(),
            retainedAmount: order.totalAmt - cancellationRequest.adminResponse.refundAmount
        };
        
        // Handle item-level refund status updates
        if (cancellationRequest.cancellationType === 'PARTIAL_ITEMS') {
            // Update only the specific cancelled items
            const cancelledItemIds = cancellationRequest.itemsToCancel.map(item => item.itemId.toString());
            
            // Update item status
            order.items.forEach(item => {
                if (cancelledItemIds.includes(item._id.toString())) {
                    item.refundStatus = 'Completed';
                }
            });
            
            // Update refundSummary status
            if (order.refundSummary && order.refundSummary.length > 0) {
                order.refundSummary.forEach(refund => {
                    if (cancelledItemIds.includes(refund.itemId.toString())) {
                        refund.status = 'Completed';
                        refund.processedDate = new Date();
                    }
                });
            }
        } else {
            // Full order cancellation - update all items
            order.items.forEach(item => {
                item.refundStatus = 'Completed';
            });
            
            // Update all refund summary entries
            if (order.refundSummary && order.refundSummary.length > 0) {
                order.refundSummary.forEach(refund => {
                    refund.status = 'Completed';
                    refund.processedDate = new Date();
                });
            }
        }
        
        await order.save();

        // Send email to user with invoice attachment
        const user = cancellationRequest.userId;
        if (user.email) {
            try {
                // Get order details with populated product info
                const orderDetails = await orderModel.findById(order._id)
                    .populate('userId', 'name email')
                    .populate('items.productId', 'name image price discount discountedPrice')
                    .populate('items.bundleId', 'title image images bundlePrice originalPrice')
                    .populate('deliveryAddress');

                // Prepare refund details for email
                const refundDetails = {
                    refundAmount: cancellationRequest.adminResponse.refundAmount,
                    refundPercentage: cancellationRequest.adminResponse.refundPercentage,
                    refundId: cancellationRequest.refundDetails.refundId,
                    refundDate: cancellationRequest.refundDetails.refundDate,
                    refundReason: cancellationRequest.reason || 'Order Cancellation',
                    retainedAmount: order.totalAmt - cancellationRequest.adminResponse.refundAmount
                };

                // Send refund invoice email using our new function
                await sendRefundInvoiceEmail(orderDetails, refundDetails);
                
            } catch (emailError) {
                console.error('Error sending refund email:', emailError);
                // Don't throw, as the refund was successful even if the email failed
            }
        }

        res.status(200).json({
            success: true,
            error: false,
            message: "Refund processed successfully",
            data: {
                refundId: cancellationRequest.refundDetails.refundId,
                refundDate: cancellationRequest.refundDetails.refundDate,
                refundAmount: cancellationRequest.adminResponse.refundAmount,
                orderNumber: order.orderId
            }
        });

    } catch (error) {
        console.error("Error in completeRefund:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error",
            details: error.message
        });
    }
};

// Get all refunds (Admin)
export const getAllRefunds = async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'all' } = req.query;
        
        const filter = {};
        
        // Filter by refund status
        if (status !== 'all') {
            filter['refundDetails.refundStatus'] = status;
        } else {
            // Only get requests with refund status (approved or in process)
            filter.status = 'APPROVED';
        }

        const refunds = await orderCancellationModel.find(filter)
            .populate({
                path: 'orderId',
                select: 'orderId totalAmt orderDate orderStatus paymentStatus paymentMethod items subTotalAmt totalQuantity orderQuantity productDetails estimatedDeliveryDate actualDeliveryDate deliveryNotes',
                populate: [
                    {
                        path: 'items.productId',
                        select: 'name title images image price _id'
                    },
                    {
                        path: 'items.bundleId',
                        select: 'title name images image bundlePrice price _id'
                    }
                ]
            })
            .populate('userId', 'name email')
            .populate('adminResponse.processedBy', 'name')
            .sort({ 'refundDetails.refundDate': -1, 'adminResponse.processedDate': -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        // Enhance refunds with delivery insights - safely handle null or undefined values
        const enhancedRefunds = refunds.map(refund => {
            const refundObj = refund.toObject();
            
            // Add delivery context - with null checks
            if (refund.orderId) {
                const deliveryContext = {
                    hasEstimatedDate: refund.orderId.estimatedDeliveryDate ? true : false,
                    hasActualDeliveryDate: refund.orderId.actualDeliveryDate ? true : false,
                    isOverdue: refund.orderId.estimatedDeliveryDate && 
                        new Date() > new Date(refund.orderId.estimatedDeliveryDate) && 
                        !refund.orderId.actualDeliveryDate,
                    daysBetweenOrderAndCancellation: refund.orderId.orderDate ? Math.floor(
                        (new Date(refund.requestDate) - new Date(refund.orderId.orderDate)) / (1000 * 60 * 60 * 24)
                    ) : 0
                };
                
                if (refund.orderId.actualDeliveryDate) {
                    deliveryContext.daysBetweenDeliveryAndCancellation = Math.floor(
                        (new Date(refund.requestDate) - new Date(refund.orderId.actualDeliveryDate)) / (1000 * 60 * 60 * 24)
                    );
                }
                
                refundObj.deliveryContext = deliveryContext;
            }
            
            return refundObj;
        });
        
        // Safely log the first refund's order details to debug
        if (enhancedRefunds.length > 0 && enhancedRefunds[0].orderId && enhancedRefunds[0].orderId.items) {
            try {
                console.log("First refund order items:", 
                    JSON.stringify(enhancedRefunds[0].orderId.items.map(item => ({
                        itemType: item.itemType,
                        productId: item.productId && typeof item.productId === 'object' ? item.productId._id : item.productId,
                        bundleId: item.bundleId && typeof item.bundleId === 'object' ? item.bundleId._id : item.bundleId,
                        productDetails: item.productDetails,
                        bundleDetails: item.bundleDetails
                    })))
                );
            } catch (logError) {
                console.error("Error logging refund items:", logError);
                // Continue execution even if logging fails
            }
        }

        const total = await orderCancellationModel.countDocuments(filter);

        res.status(200).json({
            success: true,
            error: false,
            data: {
                refunds: enhancedRefunds,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRefunds: total
            }
        });

    } catch (error) {
        console.error("Error in getAllRefunds:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// Get cancellation policy
export const getCancellationPolicy = async (req, res) => {
    try {
        const policy = await cancellationPolicyModel.findOne({ isActive: true });
        
        if (!policy) {
            // Create default policy if none exists
            const defaultPolicy = new cancellationPolicyModel({
                refundPercentage: 65,
                responseTimeHours: 48,
                allowedReasons: [
                    { reason: 'Changed mind' },
                    { reason: 'Found better price' },
                    { reason: 'Wrong item ordered' },
                    { reason: 'Delivery delay' },
                    { reason: 'Product defect expected' },
                    { reason: 'Financial constraints' },
                    { reason: 'Duplicate order' },
                    { reason: 'Other' }
                ],
                timeBasedRules: [
                    { description: 'Within 1 hour of order', timeFrameHours: 1, refundPercentage: 90 },
                    { description: 'Within 24 hours of order', timeFrameHours: 24, refundPercentage: 90 },
                    { description: 'After 24 hours', timeFrameHours: 999999, refundPercentage: 75 }
                ],
                orderStatusRules: [
                    { orderStatus: 'ORDER PLACED', canCancel: true, refundPercentage: 90 },
                    { orderStatus: 'PROCESSING', canCancel: true, refundPercentage: 75 },
                    { orderStatus: 'OUT FOR DELIVERY', canCancel: false, refundPercentage: 0 },
                    { orderStatus: 'DELIVERED', canCancel: false, refundPercentage: 0 }
                ],
                terms: [
                    { title: 'Response Time', content: 'We will respond to your cancellation request within 48 hours.' },
                    { title: 'Refund Processing', content: 'Approved refunds will be processed within 5-7 business days.' },
                    { title: 'Refund Amount', content: 'Refund amount depends on order status and time of cancellation request.' }
                ]
            });
            
            await defaultPolicy.save();
            return res.status(200).json({
                success: true,
                error: false,
                data: defaultPolicy
            });
        }

        res.status(200).json({
            success: true,
            error: false,
            data: policy
        });

    } catch (error) {
        console.error("Error in getCancellationPolicy:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// Get refund statistics with delivery insights
export const getRefundStatsWithDelivery = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                requestDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }
        
        const refunds = await orderCancellationModel.find(dateFilter)
            .populate({
                path: 'orderId',
                select: 'orderDate estimatedDeliveryDate actualDeliveryDate orderStatus',
            });
            
        const stats = {
            totalRefunds: refunds.length,
            deliveryInsights: {
                cancelledBeforeDelivery: 0,
                cancelledAfterDelivery: 0,
                cancelledWithOverdueDelivery: 0,
                averageDaysBeforeCancellation: 0,
                refundsByDeliveryStatus: {
                    noDeliveryDate: 0,
                    pendingDelivery: 0,
                    delivered: 0,
                    overdue: 0
                }
            },
            refundAmountsByDeliveryStatus: {
                beforeDelivery: 0,
                afterDelivery: 0,
                overdueDelivery: 0
            }
        };
        
        let totalDaysBeforeCancellation = 0;
        let validDayCount = 0;
        
        refunds.forEach(refund => {
            if (refund.orderId) {
                const orderDate = new Date(refund.orderId.orderDate);
                const cancellationDate = new Date(refund.requestDate);
                const estimatedDelivery = refund.orderId.estimatedDeliveryDate ? new Date(refund.orderId.estimatedDeliveryDate) : null;
                const actualDelivery = refund.orderId.actualDeliveryDate ? new Date(refund.orderId.actualDeliveryDate) : null;
                
                // Calculate days before cancellation
                const daysBeforeCancellation = Math.floor((cancellationDate - orderDate) / (1000 * 60 * 60 * 24));
                totalDaysBeforeCancellation += daysBeforeCancellation;
                validDayCount++;
                
                // Delivery status analysis
                if (!estimatedDelivery) {
                    stats.deliveryInsights.refundsByDeliveryStatus.noDeliveryDate++;
                } else if (actualDelivery) {
                    stats.deliveryInsights.refundsByDeliveryStatus.delivered++;
                    stats.deliveryInsights.cancelledAfterDelivery++;
                    if (refund.refundDetails?.refundAmount) {
                        stats.refundAmountsByDeliveryStatus.afterDelivery += refund.refundDetails.refundAmount;
                    }
                } else if (new Date() > estimatedDelivery) {
                    stats.deliveryInsights.refundsByDeliveryStatus.overdue++;
                    stats.deliveryInsights.cancelledWithOverdueDelivery++;
                    if (refund.refundDetails?.refundAmount) {
                        stats.refundAmountsByDeliveryStatus.overdueDelivery += refund.refundDetails.refundAmount;
                    }
                } else {
                    stats.deliveryInsights.refundsByDeliveryStatus.pendingDelivery++;
                    stats.deliveryInsights.cancelledBeforeDelivery++;
                    if (refund.refundDetails?.refundAmount) {
                        stats.refundAmountsByDeliveryStatus.beforeDelivery += refund.refundDetails.refundAmount;
                    }
                }
            }
        });
        
        stats.deliveryInsights.averageDaysBeforeCancellation = validDayCount > 0 ? 
            Math.round(totalDaysBeforeCancellation / validDayCount) : 0;
        
        res.status(200).json({
            success: true,
            error: false,
            data: stats
        });
    } catch (error) {
        console.error('Error getting refund stats with delivery:', error);
        res.status(500).json({
            success: false,
            error: true,
            message: 'Internal server error'
        });
    }
};

// Update cancellation policy (Admin only)
export const updateCancellationPolicy = async (req, res) => {
    try {
        const adminId = req.userId;
        const updateData = req.body;

        const policy = await cancellationPolicyModel.findOneAndUpdate(
            { isActive: true },
            {
                ...updateData,
                lastUpdated: new Date(),
                updatedBy: adminId
            },
            { new: true, upsert: true }
        );

        res.status(200).json({
            success: true,
            error: false,
            message: "Cancellation policy updated successfully",
            data: policy
        });

    } catch (error) {
        console.error("Error in updateCancellationPolicy:", error);
        res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error"
        });
    }
};

// Get all refunds for a specific user
export const getUserRefunds = async (req, res) => {
    try {
        const userId = req.userId;
        
        // Query for all cancellation/refund requests belonging to this user
        const userRefunds = await orderCancellationModel.find({
            userId: userId,
        })
        .populate({
            path: 'orderId',
            select: 'orderId totalAmt orderDate orderStatus paymentMethod paymentStatus items subTotalAmt totalQuantity',
            populate: [
                {
                    path: 'items.productId',
                    select: 'name title images image price discount'
                },
                {
                    path: 'items.bundleId',
                    select: 'title name images image bundlePrice price'
                }
            ]
        })
        .populate('userId', 'name email')
        .sort({ 
            requestDate: -1, 
            'refundDetails.refundDate': -1, 
            'adminResponse.processedDate': -1 
        });

        // Return the refunds
        return res.status(200).json({
            success: true,
            error: false,
            message: "User refunds retrieved successfully",
            data: userRefunds
        });
    } catch (error) {
        console.error("Error getting user refunds:", error);
        return res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error while getting user refunds"
        });
    }
};

// Get refund invoice
export const getRefundInvoice = async (req, res) => {
    try {
        const userId = req.userId;
        const refundId = req.params.refundId;
        
        if (!refundId) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Refund ID is required"
            });
        }
        
        // Find the refund record
        const refund = await orderCancellationModel.findOne({
            userId: userId,
            'refundDetails.refundId': refundId,
            status: 'APPROVED',
            'refundDetails.refundStatus': 'COMPLETED'
        })
        .populate({
            path: 'orderId',
            populate: [
                {
                    path: 'items.productId',
                    select: 'name image price discount description brand category'
                },
                {
                    path: 'items.bundleId',
                    select: 'title image bundlePrice originalPrice description items'
                },
                {
                    path: 'deliveryAddress',
                    select: 'address_line city state pincode country landmark addressType mobile'
                }
            ]
        })
        .populate('userId', 'name email mobile');
        
        if (!refund) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Refund not found or not authorized to access"
            });
        }
        
        // Check if invoice file exists
        const invoicePath = `./invoices/refund-${refundId}.pdf`;
        
        if (!fs.existsSync(invoicePath)) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Invoice file not found"
            });
        }
        
        // Send the file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=refund-invoice-${refundId}.pdf`);
        
        const fileStream = fs.createReadStream(invoicePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error("Error getting refund invoice:", error);
        return res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error while getting refund invoice"
        });
    }
};

// Get cancellation details by order ID
export const getCancellationByOrderId = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Order ID is required"
            });
        }

        // Find the order first to get the object ID
        const order = await orderModel.findOne({ orderId: orderId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Order not found"
            });
        }

        // Find cancellation request by order object ID
        const cancellationRequest = await orderCancellationModel.findOne({ orderId: order._id })
            .populate({
                path: 'orderId',
                select: 'orderId totalAmt orderDate orderStatus paymentMethod paymentStatus items subTotalAmt totalQuantity'
            })
            .populate({
                path: 'userId',
                select: 'name email'
            })
            .populate({
                path: 'adminResponse.processedBy',
                select: 'name email'
            });

        if (!cancellationRequest) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "No cancellation request found for this order"
            });
        }

        return res.status(200).json({
            success: true,
            error: false,
            message: "Cancellation details retrieved successfully",
            data: cancellationRequest
        });

    } catch (error) {
        console.error("Error getting cancellation details by order ID:", error);
        return res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error while getting cancellation details"
        });
    }
};

// Request Partial Item Cancellation
export const requestPartialItemCancellation = async (req, res) => {
    try {
        const { 
            orderId, 
            itemsToCancel, 
            reason, 
            additionalReason, 
            totalRefundAmount, 
            totalItemValue,
            deliveryChargeRefund,
            isEffectivelyFullCancellation,
            deliveryCharge,
            isContinuationCancellation,
            isLastRemainingItem
        } = req.body;
        const userId = req.userId;

        console.log('Partial cancellation request data:', {
            orderId,
            itemsToCancel,
            reason,
            additionalReason,
            isContinuationCancellation,
            isLastRemainingItem,
            totalRefundAmount,
            totalItemValue,
            deliveryChargeRefund,
            isEffectivelyFullCancellation,
            deliveryCharge,
            body: req.body
        });

        // Validate input
        if (!orderId || !itemsToCancel || !Array.isArray(itemsToCancel) || itemsToCancel.length === 0) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Order ID and items to cancel are required"
            });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "Cancellation reason is required"
            });
        }

        // Find the order
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Order not found"
            });
        }

        // Check if user owns this order - with special handling for continuation cancellations
        if (!isContinuationCancellation && !isLastRemainingItem && order.userId.toString() !== userId) {
            // For normal cancellations, strictly verify ownership
            return res.status(403).json({
                success: false,
                error: true,
                message: "You don't have permission to cancel this order"
            });
        }
        
        // For continuation cancellations or last remaining item, we're more lenient with verification
        // because the user has already been verified for the initial cancellation
        if ((isContinuationCancellation || isLastRemainingItem) && order.userId.toString() !== userId) {
            console.log(`⚠️ User ID mismatch in continuation cancellation, but proceeding anyway: 
                Current user: ${userId}, 
                Order user: ${order.userId}`);
        }

        // Check if order is in a cancellable state
        const nonCancellableStatuses = ['CANCELLED', 'DELIVERED', 'RETURNED'];
        if (nonCancellableStatuses.includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                error: true,
                message: `Cannot cancel order with status: ${order.orderStatus}`
            });
        }

        // Check if there's already a pending cancellation request for this order
        const existingCancellation = await orderCancellationModel.findOne({
            orderId: orderId,
            status: 'PENDING'
        });

        // Check if there's an approved cancellation but there are still active items that can be cancelled
        const existingApprovedCancellations = await orderCancellationModel.find({
            orderId: orderId,
            status: 'APPROVED'
        });
        
        // If there's a pending cancellation and no special flags for continuation
        if (existingCancellation && !isContinuationCancellation && !isLastRemainingItem) {
            return res.status(400).json({
                success: false,
                error: true,
                message: "There is already a pending cancellation request for this order"
            });
        }
        
        // If we have approved cancellations, we need to check if there are still active items to cancel
        if (existingApprovedCancellations.length > 0 && !isContinuationCancellation && !isLastRemainingItem) {
            // Get all items that have been approved for cancellation
            const cancelledItemIds = new Set();
            
            for (const cancelReq of existingApprovedCancellations) {
                if (cancelReq.cancellationType === 'FULL_ORDER') {
                    // If a full order cancellation was approved, no more items can be cancelled
                    return res.status(400).json({
                        success: false,
                        error: true,
                        message: "This order was already fully cancelled"
                    });
                }
                
                // For partial cancellations, collect all item IDs
                if (cancelReq.itemsToCancel && Array.isArray(cancelReq.itemsToCancel)) {
                    cancelReq.itemsToCancel.forEach(item => {
                        cancelledItemIds.add(item.itemId.toString());
                    });
                }
            }
            
            // Check if all items in the order are already cancelled
            const allItemsAlreadyCancelled = order.items.every(item => 
                cancelledItemIds.has(item._id.toString())
            );
            
            if (allItemsAlreadyCancelled) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: "All items in this order are already cancelled or pending cancellation"
                });
            }
            
            // Ensure the items being cancelled aren't already cancelled
            for (const itemToCancel of itemsToCancel) {
                if (cancelledItemIds.has(itemToCancel.itemId)) {
                    return res.status(400).json({
                        success: false,
                        error: true,
                        message: `Item with ID ${itemToCancel.itemId} is already cancelled or pending cancellation`
                    });
                }
            }
        }

        // Validate items to cancel exist in the order and enhance with pricing data
        const validatedItemsToCancel = [];
        let calculatedTotalRefundAmount = 0;
        let calculatedTotalItemValue = 0;

        for (const itemToCancel of itemsToCancel) {
            const orderItem = order.items.find(item => 
                item._id.toString() === itemToCancel.itemId
            );

            if (!orderItem) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: `Item with ID ${itemToCancel.itemId} not found in order`
                });
            }

            // Use enhanced pricing data from frontend if available, otherwise calculate
            let itemRefundAmount, itemTotalValue;
            
            if (itemToCancel.refundAmount !== undefined) {
                itemRefundAmount = itemToCancel.refundAmount;
                console.log('✅ Using frontend refund amount for item:', itemRefundAmount);
            } else if (itemToCancel.pricingBreakdown?.refundAmount !== undefined) {
                itemRefundAmount = itemToCancel.pricingBreakdown.refundAmount;
            } else {
                // Fallback calculation using RefundPolicyService
                const fallbackAmount = orderItem.itemTotal || (orderItem.sizeAdjustedPrice || orderItem.productDetails?.price || 0) * orderItem.quantity;
                
                // Import RefundPolicyService
                const { RefundPolicyService } = await import('../utils/RefundPolicyService.js');
                
                // Create a mock item-level cancellation request
                const itemCancellationContext = {
                    requestDate: new Date(),
                    deliveryInfo: {
                        wasPastDeliveryDate: order.estimatedDeliveryDate && new Date() > new Date(order.estimatedDeliveryDate),
                        actualDeliveryDate: order.actualDeliveryDate
                    }
                };
                
                // Get refund calculation from the service
                const refundResult = RefundPolicyService.calculateRefundAmount(
                    { totalAmt: fallbackAmount }, 
                    itemCancellationContext
                );
                
                itemRefundAmount = refundResult.refundAmount;
            }

            if (itemToCancel.totalPrice !== undefined) {
                itemTotalValue = itemToCancel.totalPrice;
            } else if (itemToCancel.pricingBreakdown?.totalCustomerPaid !== undefined) {
                itemTotalValue = itemToCancel.pricingBreakdown.totalCustomerPaid;
            } else {
                itemTotalValue = orderItem.itemTotal || (orderItem.sizeAdjustedPrice || orderItem.productDetails?.price || 0) * orderItem.quantity;
            }

            calculatedTotalRefundAmount += itemRefundAmount;
            calculatedTotalItemValue += itemTotalValue;

            // Enhanced item data with pricing breakdown
            validatedItemsToCancel.push({
                itemId: orderItem._id,
                productId: orderItem.productId,
                bundleId: orderItem.bundleId,
                itemType: orderItem.itemType,
                quantity: orderItem.quantity,
                size: orderItem.size,
                itemTotal: orderItem.itemTotal,
                refundAmount: itemRefundAmount,
                // Enhanced pricing data from frontend
                totalPrice: itemToCancel.totalPrice,
                itemPrice: itemToCancel.itemPrice,
                originalPrice: itemToCancel.originalPrice,
                productName: itemToCancel.productName,
                pricingBreakdown: itemToCancel.pricingBreakdown || null
            });
        }

        // Use frontend totals if provided, otherwise use calculated values
        const finalTotalRefundAmount = totalRefundAmount !== undefined ? totalRefundAmount : calculatedTotalRefundAmount;
        const finalTotalItemValue = totalItemValue !== undefined ? totalItemValue : calculatedTotalItemValue;

        console.log('Final pricing values:', {
            finalTotalRefundAmount,
            finalTotalItemValue,
            fromFrontend: totalRefundAmount !== undefined
        });

        // Get delivery information
        const deliveryInfo = {
            estimatedDeliveryDate: order.estimatedDeliveryDate,
            actualDeliveryDate: order.actualDeliveryDate,
            deliveryNotes: order.deliveryNotes,
            deliveryCharge: order.deliveryCharge || 0, // Store delivery charge at time of cancellation
            wasPastDeliveryDate: order.estimatedDeliveryDate ? new Date() > new Date(order.estimatedDeliveryDate) : false,
            // Add new delivery refund information
            deliveryChargeRefund: deliveryChargeRefund || 0,
            isEffectivelyFullCancellation: isEffectivelyFullCancellation || false
        };

        // Create cancellation request with enhanced pricing data
        const cancellationRequest = new orderCancellationModel({
            orderId: orderId,
            userId: userId,
            cancellationType: 'PARTIAL_ITEMS',
            itemsToCancel: validatedItemsToCancel,
            reason: reason,
            additionalReason: additionalReason,
            totalRefundAmount: finalTotalRefundAmount,    // Store frontend total refund amount (includes delivery if applicable)
            totalItemValue: finalTotalItemValue,          // Store frontend total item value
            deliveryInfo: deliveryInfo,
            adminResponse: {
                refundAmount: finalTotalRefundAmount,
                refundPercentage: 75
            }
        });

        const savedCancellation = await cancellationRequest.save();

        // Send notification email to user
        try {
            const user = await UserModel.findById(userId);
            if (user && user.email) {
                await sendEmail({
                    sendTo: user.email,
                    subject: `Partial Cancellation Request Submitted - Order #${order.orderId}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">Partial Cancellation Request Submitted</h2>
                            <p>Dear ${user.name},</p>
                            <p>Your request to cancel specific items from order <strong>#${order.orderId}</strong> has been submitted successfully.</p>
                            
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="margin-top: 0;">Items to Cancel:</h3>
                                <ul>
                                    ${validatedItemsToCancel.map(item => {
                                        const orderItem = order.items.find(oi => oi._id.toString() === item.itemId.toString());
                                        const itemName = item.productName || orderItem?.productDetails?.name || orderItem?.bundleDetails?.title || 'Unknown Item';
                                        return `<li>${itemName} ${item.size ? `(Size: ${item.size})` : ''} - Qty: ${item.quantity} - ₹${item.refundAmount.toFixed(2)}</li>`;
                                    }).join('')}
                                </ul>
                                <p><strong>Total Expected Refund: ₹${finalTotalRefundAmount.toFixed(2)}</strong></p>
                                <p><strong>Items Total Value: ₹${finalTotalItemValue.toFixed(2)}</strong></p>
                                ${isEffectivelyFullCancellation && deliveryChargeRefund > 0 ? 
                                    `<p><strong>Delivery Charge Refund: ₹${deliveryChargeRefund.toFixed(2)}</strong> (All items being cancelled)</p>` : 
                                    (isEffectivelyFullCancellation && order.deliveryCharge && order.deliveryCharge > 0 ? `<p><strong>Note:</strong> Delivery charge is included in the refund only for complete order cancellations</p>` : '')
                                }
                            </div>
                            
                            <p><strong>Reason:</strong> ${reason}</p>
                            ${additionalReason ? `<p><strong>Additional Details:</strong> ${additionalReason}</p>` : ''}
                            
                            <p>Your request is now being reviewed by our team. You will receive an email notification once the request is processed.</p>
                            
                            <p>Thank you for shopping with us!</p>
                            <p><strong>Customer Support Team</strong></p>
                        </div>
                    `
                });
            }
        } catch (emailError) {
            console.error("Error sending cancellation notification email:", emailError);
        }

        return res.status(201).json({
            success: true,
            error: false,
            message: "Partial item cancellation request submitted successfully",
            data: {
                cancellationId: savedCancellation._id,
                itemsToCancel: validatedItemsToCancel,
                totalRefundAmount: finalTotalRefundAmount,
                totalItemValue: finalTotalItemValue,
                status: 'PENDING',
                pricingUsed: totalRefundAmount !== undefined ? 'Enhanced pricing from frontend' : 'Calculated pricing'
            }
        });

    } catch (error) {
        console.error("Error requesting partial item cancellation:", error);
        return res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error while processing cancellation request"
        });
    }
};

// Process Partial Item Cancellation (Admin)
export const processPartialItemCancellation = async (req, res) => {
    try {
        console.log('🔵 processPartialItemCancellation called with:', {
            params: req.params,
            body: req.body,
            userId: req.userId
        });
        
        const { cancellationId } = req.params;
        const { action, adminComments, refundPercentage, calculatedRefundAmount, calculatedTotalValue, refundData } = req.body;
        const adminId = req.userId;

        if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
            console.log('❌ Invalid action:', action);
            return res.status(400).json({
                success: false,
                error: true,
                message: "Action must be either 'APPROVED' or 'REJECTED'"
            });
        }

        console.log('🔍 Looking for cancellation request:', cancellationId);

        // Find the cancellation request
        const cancellationRequest = await orderCancellationModel.findById(cancellationId)
            .populate('orderId')
            .populate('userId');

        console.log('📋 Found cancellation request:', {
            id: cancellationRequest?._id,
            status: cancellationRequest?.status,
            orderId: cancellationRequest?.orderId?._id,
            userId: cancellationRequest?.userId?._id
        });

        if (!cancellationRequest) {
            console.log('❌ Cancellation request not found:', cancellationId);
            return res.status(404).json({
                success: false,
                error: true,
                message: "Cancellation request not found"
            });
        }

        if (cancellationRequest.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: true,
                message: "This cancellation request has already been processed"
            });
        }

        const order = cancellationRequest.orderId;

        // Update cancellation request
        cancellationRequest.status = action;
        cancellationRequest.adminResponse.processedBy = adminId;
        cancellationRequest.adminResponse.processedDate = new Date();
        cancellationRequest.adminResponse.adminComments = adminComments || '';

        if (action === 'APPROVED') {
            // Priority 1: Use frontend-calculated refund amount if available (includes discount pricing)
            let totalRefundAmount = 0;
            let finalRefundPercentage = refundPercentage || cancellationRequest.adminResponse.refundPercentage || 75;
            
            if (calculatedRefundAmount !== undefined && calculatedTotalValue !== undefined) {
                // Use the calculated amounts from frontend that incorporate discount pricing
                totalRefundAmount = calculatedRefundAmount;
                
                // Check if this is a full order cancellation or cancelling the last remaining item
                const allItemsCancelled = cancellationRequest.itemsToCancel.length === order.items.length;
                const isLastItemCancellation = cancellationRequest.itemsToCancel.length === 1 && 
                                              order.items.length === 1;
                
                // Only include delivery charge in refund for full order cancellation or last item cancellation
                let deliveryChargeRefund = 0;
                if (allItemsCancelled || isLastItemCancellation) {
                    deliveryChargeRefund = order.deliveryCharge || 0;
                    totalRefundAmount += deliveryChargeRefund;
                }
                
                console.log('💰 Using Frontend-Calculated Partial Refund:', {
                    calculatedRefundAmount: calculatedRefundAmount,
                    isFullCancellation: allItemsCancelled,
                    isLastItemCancellation: isLastItemCancellation,
                    deliveryChargeRefund: deliveryChargeRefund,
                    totalRefundAmount: totalRefundAmount,
                    calculatedTotalValue: calculatedTotalValue,
                    frontendRefundPercentage: finalRefundPercentage,
                    basedOnDiscountedPricing: refundData?.basedOnDiscountedPricing || false
                });
                
                // Update individual item refund amounts proportionally
                if (cancellationRequest.itemsToCancel && cancellationRequest.itemsToCancel.length > 0) {
                    cancellationRequest.itemsToCancel.forEach(item => {
                        // Use the refund amount from the individual item if available
                        if (item.refundAmount !== undefined) {
                            // The item refund amount is already included in totalRefundAmount calculation
                            // No need to add it again here
                            console.log('✅ Item refund amount already included:', item.refundAmount);
                        }
                    });
                }
            } else {
                // Fallback to original calculation logic for backward compatibility
                let itemsRefundTotal = 0;
                cancellationRequest.itemsToCancel.forEach(item => {
                    const calculatedRefund = (item.refundAmount * finalRefundPercentage) / 100;
                    item.refundAmount = Math.round(calculatedRefund * 100) / 100; // Round to 2 decimal places
                    itemsRefundTotal += item.refundAmount;
                });
                
                // Check if this is a full order cancellation or cancelling the last remaining item
                const allItemsCancelled = cancellationRequest.itemsToCancel.length === order.items.length;
                const isLastItemCancellation = cancellationRequest.itemsToCancel.length === 1 && 
                                              order.items.length === 1;
                
                // Only include delivery charge in refund for full order cancellation or last item cancellation
                let deliveryChargeRefund = 0;
                if (allItemsCancelled || isLastItemCancellation) {
                    deliveryChargeRefund = order.deliveryCharge || 0;
                }
                
                totalRefundAmount = itemsRefundTotal + deliveryChargeRefund;
                
                console.log('💰 Fallback Partial Refund Calculation:', {
                    itemsRefundTotal: itemsRefundTotal,
                    isFullCancellation: allItemsCancelled,
                    isLastItemCancellation: isLastItemCancellation,
                    deliveryChargeRefund: deliveryChargeRefund,
                    totalRefundAmount: totalRefundAmount,
                    refundPercentage: finalRefundPercentage
                });
            }

            cancellationRequest.adminResponse.refundAmount = totalRefundAmount;
            cancellationRequest.adminResponse.refundPercentage = finalRefundPercentage;
            
            // Store enhanced refund data if provided from frontend
            if (refundData) {
                cancellationRequest.refundDetails.enhancedRefundData = {
                    ...refundData,
                    processedAt: new Date(),
                    processedBy: adminId
                };
                
                console.log('📊 Stored enhanced partial refund data:', cancellationRequest.refundDetails.enhancedRefundData);
            }

            // Update order - mark cancelled items and adjust totals
            // Use the already populated order from cancellationRequest
            const orderToUpdate = cancellationRequest.orderId;
            if (!orderToUpdate) {
                throw new Error("Order not found during processing");
            }
            
            const itemsToCancel = cancellationRequest.itemsToCancel.map(item => item.itemId.toString());
            const refundSummary = [];
            
            // Recalculate order totals
            let newSubTotal = 0;
            let newTotalQuantity = 0;
            
            // Update each item's status
            orderToUpdate.items.forEach(item => {
                if (itemsToCancel.includes(item._id.toString())) {
                    // Mark item as cancelled
                    item.status = 'Cancelled';
                    item.cancelApproved = true;
                    item.refundStatus = 'Processing';
                    
                    // Find the cancellation item to get refund amount
                    const cancelItem = cancellationRequest.itemsToCancel.find(
                        ci => ci.itemId.toString() === item._id.toString()
                    );
                    
                    if (cancelItem) {
                        item.refundAmount = cancelItem.refundAmount;
                        item.cancellationId = cancellationRequest._id;
                        
                        // Add to refundSummary
                        refundSummary.push({
                            itemId: item._id,
                            amount: cancelItem.refundAmount,
                            status: 'Processing'
                        });
                    }
                } else {
                    // Count only active items for order totals
                    newSubTotal += item.itemTotal || (item.sizeAdjustedPrice || item.productDetails?.price || 0) * item.quantity;
                    newTotalQuantity += item.quantity;
                }
            });
            
            // Add refund summary to order
            orderToUpdate.refundSummary = [...(orderToUpdate.refundSummary || []), ...refundSummary];
            
            // Count active and cancelled items
            const activeItems = orderToUpdate.items.filter(item => item.status === 'Active').length;
            const cancelledItems = orderToUpdate.items.filter(item => item.status === 'Cancelled').length;
            
            // Only adjust totals if there are active items left
            if (activeItems > 0) {
                // For partial cancellations, retain the full delivery charge if there are items remaining
                // Delivery charge is only refunded for total order cancellation or when cancelling the last remaining item
                const isLastRemainingItemCancellation = activeItems === 1 && cancelledItems >= 1;
                const shouldRefundDeliveryCharge = false; // Always keep delivery charge for partial cancellations
                
                // Set the subtotal to the sum of remaining active item prices
                orderToUpdate.subTotalAmt = newSubTotal;
                
                // Set the total to subtotal + full delivery charge (no proportional reduction)
                // Always add full delivery charge for partial cancellations
                orderToUpdate.totalAmt = newSubTotal + (orderToUpdate.deliveryCharge || 0);
                orderToUpdate.totalQuantity = newTotalQuantity;
                
                console.log('🚚 Order Total Calculation with Full Delivery Charge:', {
                    newSubTotal,
                    deliveryCharge: orderToUpdate.deliveryCharge || 0,
                    totalAmount: orderToUpdate.totalAmt,
                    activeItemsCount: activeItems,
                    cancelledItemsCount: cancelledItems,
                    isLastRemainingItemCancellation,
                    retainingFullDeliveryCharge: true
                });
            }
            
            // If all items cancelled, mark order as cancelled
            if (activeItems === 0 && cancelledItems > 0) {
                orderToUpdate.orderStatus = 'CANCELLED';
                orderToUpdate.isFullOrderCancelled = true;
                
                // If everything is cancelled, we need to preserve the original totals for accounting
                // but mark it clearly as cancelled
                orderToUpdate.paymentStatus = 'REFUND_PROCESSING';
            }
            
            await orderToUpdate.save();
        }

        await cancellationRequest.save();

        // Send notification email
        try {
            const user = cancellationRequest.userId;
            if (user && user.email) {
                const emailSubject = action === 'APPROVED' 
                    ? `Partial Cancellation Approved - Order #${orderToUpdate.orderId}`
                    : `Partial Cancellation Request Declined - Order #${orderToUpdate.orderId}`;

                let emailContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: ${action === 'APPROVED' ? '#28a745' : '#dc3545'};">
                            Partial Cancellation ${action === 'APPROVED' ? 'Approved' : 'Declined'}
                        </h2>
                        <p>Dear ${user.name},</p>
                `;

                if (action === 'APPROVED') {
                    emailContent += `
                        <p>Your request to cancel specific items from order <strong>#${orderToUpdate.orderId}</strong> has been approved.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Cancelled Items:</h3>
                            <ul>
                                ${cancellationRequest.itemsToCancel.map(item => {
                                    const orderItem = orderToUpdate.items.find(oi => oi._id && oi._id.toString() === item.itemId.toString());
                                    const itemName = orderItem?.productDetails?.name || orderItem?.bundleDetails?.title || 'Cancelled Item';
                                    return `<li>${itemName} ${item.size ? `(Size: ${item.size})` : ''} - ₹${item.refundAmount}</li>`;
                                }).join('')}
                            </ul>
                            <p><strong>Total Refund Amount: ₹${cancellationRequest.adminResponse.refundAmount}</strong></p>
                            <p><strong>Refund Percentage: ${cancellationRequest.adminResponse.refundPercentage}%</strong></p>
                        </div>
                        
                        <p>The refund will be processed within 5-7 business days to your original payment method.</p>
                    `;
                } else {
                    emailContent += `
                        <p>Unfortunately, your request to cancel specific items from order <strong>#${orderToUpdate.orderId}</strong> has been declined.</p>
                        ${adminComments ? `<p><strong>Reason:</strong> ${adminComments}</p>` : ''}
                        <p>If you have any questions, please contact our customer support.</p>
                    `;
                }

                emailContent += `
                        <p>Thank you for your understanding!</p>
                        <p><strong>Customer Support Team</strong></p>
                    </div>
                `;

                await sendEmail({
                    sendTo: user.email,
                    subject: emailSubject,
                    html: emailContent
                });
            }
        } catch (emailError) {
            console.error("Error sending cancellation response email:", emailError);
        }

        return res.status(200).json({
            success: true,
            error: false,
            message: `Partial item cancellation ${action.toLowerCase()} successfully`,
            data: {
                cancellationId: cancellationRequest._id,
                status: action,
                refundAmount: action === 'APPROVED' ? cancellationRequest.adminResponse.refundAmount : 0,
                itemsProcessed: cancellationRequest.itemsToCancel.length
            }
        });

    } catch (error) {
        console.error("❌ Error processing partial item cancellation:", {
            error: error.message,
            stack: error.stack,
            cancellationId: req.params?.cancellationId,
            userId: req.userId
        });
        return res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error while processing cancellation",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get Partial Cancellation Details
export const getPartialCancellationDetails = async (req, res) => {
    try {
        const { cancellationId } = req.params;
        const userId = req.userId;
        const isAdmin = req.isAdmin;

        const cancellationRequest = await orderCancellationModel.findById(cancellationId)
            .populate('orderId')
            .populate('userId', 'name email')
            .populate('adminResponse.processedBy', 'name email')
            .lean();

        if (!cancellationRequest) {
            return res.status(404).json({
                success: false,
                error: true,
                message: "Cancellation request not found"
            });
        }

        // Check permissions
        if (!isAdmin && cancellationRequest.userId._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: true,
                message: "You don't have permission to view this cancellation request"
            });
        }

        // Enhance item details with product/bundle information
        const enhancedItemsToCancel = await Promise.all(
            cancellationRequest.itemsToCancel.map(async (item) => {
                let itemDetails = { ...item };
                
                if (item.itemType === 'product' && item.productId) {
                    const product = await ProductModel.findById(item.productId).lean();
                    if (product) {
                        itemDetails.productDetails = {
                            name: product.name,
                            image: product.image,
                            price: product.price,
                            category: product.category
                        };
                    }
                } else if (item.itemType === 'bundle' && item.bundleId) {
                    const bundle = await BundleModel.findById(item.bundleId).lean();
                    if (bundle) {
                        itemDetails.bundleDetails = {
                            title: bundle.title,
                            image: bundle.image,
                            bundlePrice: bundle.bundlePrice
                        };
                    }
                }
                
                return itemDetails;
            })
        );

        return res.status(200).json({
            success: true,
            error: false,
            message: "Partial cancellation details retrieved successfully",
            data: {
                ...cancellationRequest,
                itemsToCancel: enhancedItemsToCancel
            }
        });

    } catch (error) {
        console.error("Error getting partial cancellation details:", error);
        return res.status(500).json({
            success: false,
            error: true,
            message: "Internal server error while getting cancellation details"
        });
    }
};
