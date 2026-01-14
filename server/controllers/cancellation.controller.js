import cancellationRequestModel from "../models/cancellationRequest.model.js";
import orderModel from "../models/order.model.js";
import refundModel from "../models/refund.model.js";
import userModel from "../models/users.model.js";
import sendEmail from "../config/sendEmail.js";

// User requests order cancellation
export async function requestCancellation(req, res) {
    try {
        const { orderId, reason, customReason, additionalReason, customerNotes } = req.body;
        const userId = req.userId;

        // Use customReason or additionalReason for backward compatibility
        const finalCustomReason = customReason || additionalReason;

        // Validate required fields
        if (!orderId || !reason) {
            return res.status(400).json({
                message: "Order ID and reason are required",
                error: true,
                success: false
            });
        }

        // Check if order exists and belongs to user
        const order = await orderModel.findOne({ 
            _id: orderId, 
            userId: userId 
        }).populate('items.productId items.bundleId', 'name title image price bundlePrice');

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        // Check if order can be cancelled
        const nonCancellableStatuses = ["DELIVERED", "CANCELLED", "CANCEL REQUESTED", "REFUND PROCESSING", "REFUNDED"];
        if (nonCancellableStatuses.includes(order.orderStatus)) {
            return res.status(400).json({
                message: `Order cannot be cancelled. Current status: ${order.orderStatus}`,
                error: true,
                success: false
            });
        }

        // Check if cancellation request already exists
        const existingRequest = await cancellationRequestModel.findOne({ orderId: orderId });
        if (existingRequest) {
            return res.status(400).json({
                message: "Cancellation request already exists for this order",
                error: true,
                success: false
            });
        }

        // Prepare cancelled items data from the order
        const cancelledItems = order.items.map((item, index) => ({
            productId: item.productId || null,
            productDetails: item.productDetails || null,
            bundleId: item.bundleId || null,
            bundleDetails: item.bundleDetails || null,
            itemType: item.itemType || 'product',
            quantity: item.quantity,
            itemTotal: item.itemTotal,
            originalItemIndex: index
        }));

        // Calculate total cancelled amount
        const totalCancelledAmount = cancelledItems.reduce((total, item) => total + item.itemTotal, 0);

        // Create cancellation request
        const cancellationRequest = new cancellationRequestModel({
            orderId: orderId,
            userId: userId,
            reason: reason,
            customReason: finalCustomReason,
            customerNotes: customerNotes || "",
            cancelledItems: cancelledItems,
            totalCancelledAmount: totalCancelledAmount
        });

        await cancellationRequest.save();

        // Update order status to "CANCEL REQUESTED"
        await orderModel.findByIdAndUpdate(orderId, {
            orderStatus: "CANCEL REQUESTED"
        });

        // Get user details for notification
        const user = await userModel.findById(userId);

        // Send email notification to user
        try {
            await sendEmail({
                sendTo: user.email,
                subject: "Cancellation Request Received",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Cancellation Request Received</h2>
                        <p>Dear ${user.name},</p>
                        <p>We have received your cancellation request for order <strong>#${order.orderId}</strong>.</p>
                        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="margin: 0 0 10px 0;">Request Details:</h3>
                            <p><strong>Order ID:</strong> ${order.orderId}</p>
                            <p><strong>Reason:</strong> ${reason === 'other' || reason === 'Other' ? finalCustomReason : reason.replace('_', ' ')}</p>
                            <p><strong>Request Date:</strong> ${new Date().toLocaleDateString()}</p>
                            <p><strong>Status:</strong> PENDING Review</p>
                        </div>
                        <p>Our team will review your request and get back to you within 24-48 hours.</p>
                        <p>Thank you for choosing us.</p>
                        <p>Best regards,<br>Customer Support Team</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error("Failed to send cancellation email:", emailError);
        }

        res.status(201).json({
            message: "Cancellation request submitted successfully",
            success: true,
            error: false,
            data: {
                cancellationId: cancellationRequest.cancellationId,
                status: "PENDING"
            }
        });

    } catch (error) {
        console.error("Error in requestCancellation:", error);
        res.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
}

// Admin processes cancellation request (approve/reject)
export async function processCancellationRequest(req, res) {
    try {
        const { requestId, cancellationId, action, adminComments, adminResponse } = req.body;
        const adminId = req.userId;

        // Use requestId if provided, otherwise use cancellationId for backward compatibility
        const searchId = requestId || cancellationId;
        const responseText = adminComments || adminResponse;

        // Validate required fields
        if (!searchId || !action || !['approve', 'reject', 'APPROVED', 'REJECTED'].includes(action)) {
            return res.status(400).json({
                message: "Request ID and valid action (approve/reject) are required",
                error: true,
                success: false,
                debug: {
                    requestId: requestId || "missing",
                    cancellationId: cancellationId || "missing", 
                    action: action || "missing",
                    validActions: ['approve', 'reject', 'APPROVED', 'REJECTED']
                }
            });
        }

        // Find cancellation request - try by MongoDB _id first, then by cancellationId
        let cancellationRequest;
        
        // Check if searchId looks like a MongoDB ObjectId (24 hex characters)
        if (searchId.match(/^[0-9a-fA-F]{24}$/)) {
            cancellationRequest = await cancellationRequestModel.findById(searchId)
                .populate({
                    path: 'orderId',
                    populate: {
                        path: 'items.productId items.bundleId',
                        select: 'name title image price bundlePrice'
                    }
                })
                .populate('userId');
        }
        
        // If not found by _id, try by cancellationId field
        if (!cancellationRequest) {
            cancellationRequest = await cancellationRequestModel.findOne({ 
                cancellationId: searchId 
            })
            .populate({
                path: 'orderId',
                populate: {
                    path: 'items.productId items.bundleId',
                    select: 'name title image price bundlePrice'
                }
            })
            .populate('userId');
        }

        if (!cancellationRequest) {
            return res.status(404).json({
                message: "Cancellation request not found",
                error: true,
                success: false,
                debug: {
                    searchId: searchId,
                    searchMethod: "MongoDB _id and cancellationId field"
                }
            });
        }

        if (cancellationRequest.requestStatus !== 'PENDING') {
            return res.status(400).json({
                message: "Cancellation request has already been processed",
                error: true,
                success: false
            });
        }

        // Normalize action to lowercase for processing
        const normalizedAction = action.toLowerCase();
        const isApproval = normalizedAction === 'approve' || normalizedAction === 'approved';

        // Update cancellation request
        cancellationRequest.requestStatus = isApproval ? 'approved' : 'rejected';
        cancellationRequest.responseDate = new Date();
        cancellationRequest.adminResponse = responseText || "";
        cancellationRequest.processedBy = adminId;

        await cancellationRequest.save();

        const order = cancellationRequest.orderId;
        const user = cancellationRequest.userId;

        if (isApproval) {
            // Check if payment was made
            if (order.paymentStatus && (order.paymentStatus.toLowerCase() === 'paid' || order.paymentStatus.toLowerCase() === 'successful')) {
                // Use cancelled amount if available, otherwise use order total
                const refundBaseAmount = cancellationRequest.totalCancelledAmount || order.totalAmt;
                
                // Create refund record for paid orders
                const refund = new refundModel({
                    orderId: order._id,
                    userId: user._id,
                    refundAmount: refundBaseAmount,
                    originalAmount: refundBaseAmount,
                    refundReason: 'order_cancelled',
                    refundStatus: 'pending',
                    processedBy: adminId
                });

                await refund.save();

                // Update order status to REFUND PROCESSING
                await orderModel.findByIdAndUpdate(order._id, {
                    orderStatus: "REFUND PROCESSING"
                });

                // Send approval email with refund information
                try {
                    await sendEmail({
                        sendTo: user.email,
                        subject: "Order Cancellation Approved - Refund Processing",
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #28a745;">Order Cancellation Approved</h2>
                                <p>Dear ${user.name},</p>
                                <p>Your cancellation request for order <strong>#${order.orderId}</strong> has been approved.</p>
                                <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                    <h3 style="margin: 0 0 10px 0;">Refund Details:</h3>
                                    <p><strong>Original Amount:</strong> ₹${order.totalAmt}</p>
                                    <p><strong>Refund Amount:</strong> ₹${order.totalAmt}</p>
                                    <p><strong>Refund ID:</strong> ${refund.refundId}</p>
                                    <p><strong>Status:</strong> Processing</p>
                                </div>
                                <p>Your refund is being processed and will be credited to your original payment method within 5-7 business days.</p>
                                <p>You will receive another email confirmation once the refund is completed.</p>
                                <p>Thank you for your understanding.</p>
                                <p>Best regards,<br>Customer Support Team</p>
                            </div>
                        `
                    });
                } catch (emailError) {
                    console.error("Failed to send approval email:", emailError);
                }

            } else {
                // No payment to refund, directly cancel the order
                await orderModel.findByIdAndUpdate(order._id, {
                    orderStatus: "CANCELLED"
                });

                try {
                    await sendEmail({
                        sendTo: user.email,
                        subject: "Order Cancellation Approved",
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #28a745;">Order Cancellation Approved</h2>
                                <p>Dear ${user.name},</p>
                                <p>Your cancellation request for order <strong>#${order.orderId}</strong> has been approved.</p>
                                <p>Since no payment was processed for this order, your order has been cancelled successfully.</p>
                                <p>Thank you for your understanding.</p>
                                <p>Best regards,<br>Customer Support Team</p>
                            </div>
                        `
                    });
                } catch (emailError) {
                    console.error("Failed to send approval email:", emailError);
                }
            }

        } else {
            // Rejection - restore to previous status or ORDER PLACED
            await orderModel.findByIdAndUpdate(order._id, {
                orderStatus: "CANCEL REJECTED"
            });

            // Send rejection email
            try {
                await sendEmail({
                    sendTo: user.email,
                    subject: "Order Cancellation Request Rejected",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #dc3545;">Order Cancellation Request Rejected</h2>
                            <p>Dear ${user.name},</p>
                            <p>We regret to inform you that your cancellation request for order <strong>#${order.orderId}</strong> has been rejected.</p>
                            ${responseText ? `<p><strong>Reason:</strong> ${responseText}</p>` : ''}
                            <p>Your order will continue to be processed and delivered as scheduled.</p>
                            <p>If you have any questions, please contact our customer support team.</p>
                            <p>Thank you for your understanding.</p>
                            <p>Best regards,<br>Customer Support Team</p>
                        </div>
                    `
                });
            } catch (emailError) {
                console.error("Failed to send rejection email:", emailError);
            }
        }

        res.json({
            message: `Cancellation request ${isApproval ? 'approved' : 'rejected'} successfully`,
            success: true,
            error: false,
            data: {
                status: cancellationRequest.requestStatus,
                action: isApproval ? 'approved' : 'rejected'
            }
        });

    } catch (error) {
        console.error("Error in processCancellationRequest:", error);
        res.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
}

// Get all cancellation requests (Admin)
export async function getAllCancellationRequests(req, res) {
    try {
        const { page = 1, limit = 15, status = 'all' } = req.query;

        const query = {};
        if (status !== 'all') {
            query.requestStatus = status;
        }

        const cancellationRequests = await cancellationRequestModel
            .find(query)
            .populate({
                path: 'orderId',
                select: 'orderId totalAmt orderStatus orderDate paymentMethod paymentStatus items subTotalAmt',
                populate: {
                    path: 'items.productId items.bundleId',
                    select: 'name title image price bundlePrice'
                }
            })
            .populate('userId', 'name email')
            .populate('processedBy', 'name email')
            .sort({ requestDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalRequests = await cancellationRequestModel.countDocuments(query);
        const totalPages = Math.ceil(totalRequests / limit);

        // Map requestStatus to status for frontend compatibility
        const mappedRequests = cancellationRequests.map(request => ({
            ...request.toObject(),
            status: request.requestStatus.toUpperCase() // Convert to uppercase for frontend
        }));

        res.json({
            message: "Cancellation requests fetched successfully",
            success: true,
            error: false,
            data: {
                requests: mappedRequests,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalRequests: totalRequests,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {

        res.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
}

// Get user's cancellation requests
export async function getUserCancellationRequests(req, res) {
    try {
        const userId = req.userId;

        const cancellationRequests = await cancellationRequestModel
            .find({ userId: userId })
            .populate({
                path: 'orderId',
                select: 'orderId totalAmt orderStatus orderDate paymentMethod paymentStatus items subTotalAmt',
                populate: {
                    path: 'items.productId items.bundleId',
                    select: 'name title image price bundlePrice'
                }
            })
            .sort({ requestDate: -1 });

        // Map requestStatus to status for frontend compatibility
        const mappedRequests = cancellationRequests.map(request => ({
            ...request.toObject(),
            status: request.requestStatus.toUpperCase() // Convert to uppercase for frontend
        }));

        res.json({
            message: "User cancellation requests fetched successfully",
            success: true,
            error: false,
            data: mappedRequests
        });

    } catch (error) {

        res.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
}
