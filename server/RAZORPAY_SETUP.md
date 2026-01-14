# Razorpay Integration Setup Guide

## Issue Fixed
The 500 Internal Server Error when creating Razorpay orders was caused by **invalid or expired API credentials**.

## Solution Steps

### 1. Get Razorpay API Credentials

1. **Login to Razorpay Dashboard**
   - Visit: https://dashboard.razorpay.com/

2. **Switch to Test Mode** (Top left corner)
   - For development, always use **Test Mode**
   - Test Mode lets you test payments without real money

3. **Generate API Keys**
   - Go to: Settings → API Keys
   - Or direct link: https://dashboard.razorpay.com/app/website-app-settings/api-keys
   - Click "Generate Test Key" (if you don't have one)
   - Copy both:
     - Key ID (starts with `rzp_test_`)
     - Key Secret

### 2. Update Environment Variables

Edit your `server/.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_YOUR_ACTUAL_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_ACTUAL_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=12345678
```

**Important:**
- Replace `YOUR_ACTUAL_KEY_ID` with your actual Key ID from Razorpay
- Replace `YOUR_ACTUAL_KEY_SECRET` with your actual Key Secret
- Never commit `.env` file to git (it should be in `.gitignore`)

### 3. Test the Configuration

Run the verification script:

```bash
cd server
node testRazorpay.js
```

You should see:
```
✅ SUCCESS! Razorpay is configured correctly!
```

### 4. Restart Your Server

After updating the credentials, restart your development server:

```bash
# Stop the server (Ctrl+C)
# Start again
npm run dev
```

### 5. Test Payment Flow

1. Add items to cart
2. Proceed to checkout
3. Try creating an order
4. You should now see the Razorpay payment modal

## Test Mode vs Live Mode

### Test Mode (Recommended for Development)
- Key ID starts with: `rzp_test_`
- Use test cards (no real money)
- Test card: `4111 1111 1111 1111`
- Any future CVV and expiry

### Live Mode (Production Only)
- Key ID starts with: `rzp_live_`
- Real money transactions
- Requires KYC verification
- Only use in production

## Testing Payments in Test Mode

Use these test card details:

| Card Number | Type | Behavior |
|------------|------|----------|
| 4111 1111 1111 1111 | Visa | Success |
| 5555 5555 5555 4444 | Mastercard | Success |
| 4000 0000 0000 0002 | Visa | Card declined |

**Other test details:**
- CVV: Any 3 digits (e.g., 123)
- Expiry: Any future date
- Name: Any name

## Common Issues

### Error: "Payment gateway not configured"
**Solution:** Check if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in `.env`

### Error: "Payment gateway authentication failed"
**Solution:** Your credentials are invalid. Generate new ones from Razorpay Dashboard

### Error: Still getting 500 error
**Solution:** 
1. Verify credentials are correctly copied (no extra spaces)
2. Restart server after updating .env
3. Run `node testRazorpay.js` to verify

## Security Notes

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use Test Mode in development** - Avoid using Live credentials locally
3. **Regenerate keys if exposed** - If you accidentally commit credentials, regenerate them immediately
4. **Use environment variables in production** - Don't hardcode credentials

## Additional Resources

- [Razorpay Documentation](https://razorpay.com/docs/)
- [API Documentation](https://razorpay.com/docs/api/)
- [Test Mode Guide](https://razorpay.com/docs/payments/payments/test-card-details/)
- [Webhooks Setup](https://razorpay.com/docs/webhooks/)

## Support

If you still face issues:
1. Check server console for detailed error logs
2. Verify all environment variables are set
3. Contact Razorpay support: https://razorpay.com/support/
