/**
 * Payment Configuration Controller
 * Provides payment gateway configuration and mode information to frontend
 */

/**
 * Get payment configuration
 * Returns Razorpay key ID and mode information for frontend integration
 */
export const getPaymentConfig = async (req, res) => {
    try {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const isLiveMode = keyId?.startsWith('rzp_live_');
        
        if (!keyId) {
            return res.status(500).json({
                success: false,
                error: true,
                message: 'Payment gateway not configured'
            });
        }

        return res.json({
            success: true,
            error: false,
            data: {
                razorpayKeyId: keyId,
                isLiveMode: isLiveMode,
                mode: isLiveMode ? 'live' : 'test',
                currency: 'INR'
            }
        });

    } catch (error) {
        console.error('Error getting payment config:', error);
        return res.status(500).json({
            success: false,
            error: true,
            message: 'Failed to get payment configuration'
        });
    }
};
