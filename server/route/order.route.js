import { Router } from 'express';
import Auth from '../middleware/auth.js';
import { validateStockAvailability } from '../middleware/stockValidation.js';
import { 
    onlinePaymentOrderController,
    getOrderController,
    getOrderByIdController,
    getOrderStatsController,
    getAllOrdersController,
    cancelOrderController,
    updateOrderStatusController,
    updateDeliveryDateController,
    bulkUpdateOrderStatusController,
    getOrdersByDateRangeController,
    searchOrdersController,
    checkOrderModificationPermissionController
} from '../controllers/order.controller.js';
import { 
    requestOrderCancellation,
    getCancellationRequests,
    processCancellationRequest,
    getCancellationPolicy,
    updateCancellationPolicy
} from '../controllers/orderCancellation.controller.js';
import { 
    getUserRefundDashboard,
    getUserRefundStats
} from '../controllers/userRefundManagement.controller.js';
import { admin } from '../middleware/Admin.js';
import { orderLimiter } from '../middleware/rateLimitMiddleware.js';

const orderRouter = Router();

// Apply stock validation middleware before order creation
orderRouter.post('/online-payment', Auth, orderLimiter, validateStockAvailability, onlinePaymentOrderController);
orderRouter.get('/get', Auth, getOrderController);
orderRouter.get('/order/:orderId', Auth, getOrderByIdController);
orderRouter.get('/admin/stats', Auth, admin, getOrderStatsController);
orderRouter.get('/all-orders', Auth, getAllOrdersController);
orderRouter.post('/cancel-order', Auth, orderLimiter, cancelOrderController);
orderRouter.put('/update-order-status', Auth, updateOrderStatusController);
orderRouter.put('/update-delivery-date', Auth, admin, updateDeliveryDateController);
orderRouter.put('/admin/bulk-update', Auth, admin, bulkUpdateOrderStatusController);
orderRouter.get('/admin/check-modification-permission/:orderId', Auth, admin, checkOrderModificationPermissionController);
orderRouter.get('/date-range', Auth, getOrdersByDateRangeController);
orderRouter.get('/search', Auth, searchOrdersController);

// Order Cancellation Management Routes
orderRouter.post('/request-cancellation', Auth, orderLimiter, requestOrderCancellation);
orderRouter.get('/cancellation-requests', Auth, admin, getCancellationRequests);
orderRouter.post('/process-cancellation', Auth, admin, processCancellationRequest);
orderRouter.get('/cancellation-policy', getCancellationPolicy);
orderRouter.put('/update-cancellation-policy', Auth, admin, updateCancellationPolicy);

// User Refund Management Routes
orderRouter.get('/user/refund-dashboard', Auth, getUserRefundDashboard);
orderRouter.get('/user/refund-stats', Auth, getUserRefundStats);

// Import the comprehensive order details controller
import { getComprehensiveOrderDetails } from '../controllers/orderCancellation.controller.js';

// Get comprehensive order details with all information
orderRouter.get('/comprehensive/:orderId', Auth, getComprehensiveOrderDetails);

export default orderRouter;