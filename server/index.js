import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import connectDB from './config/connectdb.js'
import logCorsConfiguration from './utils/corsDebug.js'
import { logServerInfo } from './utils/checkEnv.js'
import userRouter from './route/user.route.js'
import categoryRouter from './route/category.route.js'
import uploadRouter from './route/upload.router.js'
import productRouter from './route/product.route.js'
import cartRouter from './route/cart.route.js'
import addressRouter from './route/address.route.js'
import orderRouter from './route/order.route.js'
import contactRouter from './route/contact.route.js'  // Add this import
import bundleRouter from './route/bundle.route.js'
import wishlistRouter from './route/wishlist.route.js' // Import wishlist routes
import userManagementRouter from './route/userManagement.route.js' // Import user management routes
import paymentRouter from './route/payment.route.js' // Import payment routes
import orderCancellationRouter from './route/orderCancellation.route.js' // Import order cancellation routes
import emailRouter from './route/email.route.js' // Import email routes
import configRouter from './route/config.route.js' // Import config routes for sizes management
import customTshirtRequestRouter from './route/customTshirtRequest.route.js' // Import custom t-shirt request routes
import returnProductRouter from './route/returnProduct.route.js' // Import return product routes
import indianLocationRouter from './route/indianLocation.route.js' // Import Indian location routes
import errorHandler from './middleware/errorMiddleware.js' // Import error handler middleware
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js' // Import request ID middleware
import { getCsrfToken } from './middleware/csrfMiddleware.js' // Import CSRF middleware



dotenv.config()
const app = express()

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            process.env.FRONT_URL,
            process.env.PRODUCTION_URL,
            process.env.WWW_PRODUCTION_URL,
            "https://casual-clothings.vercel.app",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ];
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'X-CSRF-Token', 'X-XSRF-Token'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-CSRF-Token', 'X-Request-ID'],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Request ID tracking (add early in middleware chain)
app.use(requestIdMiddleware);

// Body parser with increased limits for file uploads
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())
app.use(morgan())
app.use(helmet({
    crossOriginResourcePolicy:false
}))

const PORT = 8080 || process.env.PORT

// Add a test endpoint to verify CORS
app.get('/api/test-cors', (req, res) => {
    res.json({
        message: "CORS is working properly",
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// CSRF token endpoint
app.get('/api/csrf-token', getCsrfToken);

app.get('/',(req,res)=>{
    res.json({
        message:"You are on live now on arun port "+PORT
    })
})

app.use('/api/user',userRouter)
app.use('/api/category',categoryRouter);
app.use('/api/file',uploadRouter)
app.use("/api/product",productRouter)
app.use("/api/cart",cartRouter)
app.use("/api/address",addressRouter)
app.use("/api/order",orderRouter)
app.use("/api/contact",contactRouter)  // Add this route
app.use("/api/bundle",bundleRouter)
app.use('/api/wishlist', wishlistRouter) // Use wishlist routes
app.use('/api/user-management', userManagementRouter) // Use user management routes
app.use('/api/payment', paymentRouter) // Use payment routes
app.use('/api/order-cancellation', orderCancellationRouter) // Use order cancellation routes
app.use('/api/email', emailRouter) // Use email routes
app.use('/api/config', configRouter) // Use config routes for sizes management
app.use('/api/custom-tshirt', customTshirtRequestRouter) // Use custom t-shirt request routes
app.use('/api/return-product', returnProductRouter) // Use return product routes
app.use('/api/location', indianLocationRouter) // Use Indian location routes

// Error handling middleware (must be last)
app.use(errorHandler)

connectDB().then(
    ()=>{
        app.listen(PORT,()=>{
            console.log("Server is running");
            logServerInfo(); // Check environment variables on startup
            
            // Log Razorpay mode
            const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
            if (razorpayKeyId) {
                const isLiveMode = razorpayKeyId.startsWith('rzp_live_');
                console.log(`💳 Razorpay: ${isLiveMode ? '🟢 LIVE MODE' : '🟡 TEST MODE'}`);
                if (isLiveMode) {
                    console.log('⚠️  Real transactions will be processed');
                }
            } else {
                console.log('⚠️  Razorpay credentials not configured');
            }
        })
    }
);