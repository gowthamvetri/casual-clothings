import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import App from "../App";

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
  </div>
);

// Lazy load all pages - Code Splitting Implementation
// Core pages (load immediately for better UX)
const Home = lazy(() => import("../pages/Home"));
const SearchPage = lazy(() => import("../pages/SearchPage"));
const ProductListPage = lazy(() => import("../pages/ProductListPage"));
const ProductDisplayPage = lazy(() => import("../pages/ProductDisplayPage"));

// Auth pages
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const OtpVerify = lazy(() => import("../pages/OtpVerify"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));

// Info pages
const About = lazy(() => import("../pages/About"));
const Blog = lazy(() => import("../pages/Blog"));
const SizeGuide = lazy(() => import("../pages/SizeGuide"));
const FAQ = lazy(() => import("../pages/FAQ"));
const ShippingReturns = lazy(() => import("../pages/ShippingReturns"));
const PrivacyPolicy = lazy(() => import("../pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("../pages/TermsConditions"));
const Lookbook = lazy(() => import("../pages/Lookbook"));
const Sustainability = lazy(() => import("../pages/Sustainability"));
const Sitemap = lazy(() => import("../pages/Sitemap"));
const Contact = lazy(() => import("../components/Contact"));

// Dashboard & User pages
const Dashboard = lazy(() => import("../layout/Dashboard"));
const Profile = lazy(() => import("../pages/Profile"));
const MyOrders = lazy(() => import("../pages/MyOrders"));
const UserRefundManagement = lazy(() => import("../pages/UserRefundManagement"));
const ReturnProduct = lazy(() => import("../pages/ReturnProduct"));
const Address = lazy(() => import("../pages/Address"));
const WishlistPage = lazy(() => import("../pages/WishlistPage"));
const MyCustomTshirts = lazy(() => import("../pages/MyCustomTshirts"));
const UserContactHistory = lazy(() => import("../pages/UserContactHistory"));

// Cart & Checkout pages
const CartMobile = lazy(() => import("../pages/CartMobile"));
const BagPage = lazy(() => import("../pages/BagPage"));
const AddressPage = lazy(() => import("../pages/AddressPage"));
const PaymentPage = lazy(() => import("../pages/PaymentPage"));
const CheckoutPage = lazy(() => import("../pages/CheckoutPage"));
const Success = lazy(() => import("../pages/Success"));
const Cancel = lazy(() => import("../pages/Cancel"));
const OrderSuccessPage = lazy(() => import("../pages/OrderSuccessPage"));

// Admin pages
const AdminPermission = lazy(() => import("../layout/AdminPermission"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const CategoryPage = lazy(() => import("../pages/CategoryPage"));
const UploadProduct = lazy(() => import("../pages/UploadProduct"));
const ProductAdmin = lazy(() => import("../pages/ProductAdmin"));
const BundleAdmin = lazy(() => import("../pages/BundleAdmin"));
const AdminOrderDashboard = lazy(() => import("../pages/AdminOrderDashboard"));
const UserManagement = lazy(() => import("../pages/UserManagement"));
const PaymentManagement = lazy(() => import("../pages/PaymentManagement"));
const CancellationManagementPage = lazy(() => import("../pages/CancellationManagementPage"));
const AdminReturnManagement = lazy(() => import("../pages/AdminReturnManagement"));
const CustomTshirtRequestsAdmin = lazy(() => import("../pages/CustomTshirtRequestsAdmin"));
const StockManagementPage = lazy(() => import("../pages/StockManagementPage"));
const CancellationPolicyPage = lazy(() => import("../pages/CancellationPolicyPage"));
const RefundManagementPage = lazy(() => import("../pages/RefundManagementPage"));
const InventoryManagement = lazy(() => import("../pages/InventoryManagement"));
const AdminContactManagement = lazy(() => import("../pages/AdminContactManagement"));

// Other pages
const BundleOffers = lazy(() => import("../pages/BundleOffers"));
const BundleDetail = lazy(() => import("../pages/BundleDetail"));
const CustomTshirtRequest = lazy(() => import("../pages/CustomTshirtRequest"));
const DeliveryChargeCalculator = lazy(() => import("../pages/test"));
const PageNotFound = lazy(() => import("../pages/PageNotFound"));

// Wrapper for lazy loaded components with Suspense
const LazyLoad = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
    {
        path:"/",
        element: <App/>,
        children: [
            {
                path:"/",
                element : <LazyLoad><Home/></LazyLoad>
            },
            {
                path:"/search",
                element : <LazyLoad><SearchPage/></LazyLoad>
            },
            {
                path:"/about",
                element : <LazyLoad><About/></LazyLoad>
            },
            {
                path:"/blog",
                element : <LazyLoad><Blog/></LazyLoad>
            },
            {
                path:"/size-guide",
                element : <LazyLoad><SizeGuide/></LazyLoad>
            },
            {
                path:"/faq",
                element : <LazyLoad><FAQ/></LazyLoad>
            },
            {
                path:"/shipping-returns",
                element : <LazyLoad><ShippingReturns/></LazyLoad>
            },
            {
                path:"/privacy-policy",
                element : <LazyLoad><PrivacyPolicy/></LazyLoad>
            },
            {
                path:"/terms-conditions",
                element : <LazyLoad><TermsConditions/></LazyLoad>
            },
            {
                path:"/sitemap",
                element : <LazyLoad><Sitemap/></LazyLoad>
            },
            {
                path:"/lookbook",
                element : <LazyLoad><Lookbook/></LazyLoad>
            },
            {
                path:"/sustainability",
                element : <LazyLoad><Sustainability/></LazyLoad>
            },
            {
                path:"/contact",
                element : <LazyLoad><Contact/></LazyLoad>
            },
            {
                path:"/contact-history",
                element : <LazyLoad><UserContactHistory/></LazyLoad>
            },
            {
                path:"/custom-tshirt",
                element : <LazyLoad><CustomTshirtRequest/></LazyLoad>
            },
            {
                path:"/return-product",
                element : <LazyLoad><ReturnProduct/></LazyLoad>
            },
            {
                path:"/login",
                element : <LazyLoad><Login/></LazyLoad>
            },{
                path:"/register",
                element : <LazyLoad><Register/></LazyLoad>
            },{
                path:"/forget-password",
                element : <LazyLoad><ForgotPassword/></LazyLoad>
            },{
                path:"/otp-verification",
                element : <LazyLoad><OtpVerify/></LazyLoad>
            },{
                path:"/reset-password",
                element : <LazyLoad><ResetPassword/></LazyLoad>
            },
            {
                path:"/dashboard",
                element:<LazyLoad><Dashboard/></LazyLoad>,
                children :[{
                    path:"profile",
                    element:<LazyLoad><Profile/></LazyLoad>
                },{
                    path:"myorders",
                    element:<LazyLoad><MyOrders/></LazyLoad>
                },{
                    path:"refund-dashboard",
                    element:<LazyLoad><UserRefundManagement/></LazyLoad>
                },{
                    path:"return-product",
                    element:<LazyLoad><ReturnProduct/></LazyLoad>
                },{
                    path:"address",
                    element:<LazyLoad><Address/></LazyLoad>
                },{
                    path:"wishlist",
                    element:<LazyLoad><WishlistPage/></LazyLoad>
                },
                {
                    path:"my-custom-tshirts",
                    element:<LazyLoad><MyCustomTshirts/></LazyLoad>
                },
                {
                    path:"admin",
                    element:<LazyLoad><AdminPermission><AdminDashboard/></AdminPermission></LazyLoad>
                },
                {
                    path:"category",
                    element:<LazyLoad><AdminPermission><CategoryPage/></AdminPermission></LazyLoad>
                },
                {
                    path:"upload-product",
                    element:<LazyLoad><AdminPermission><UploadProduct/></AdminPermission></LazyLoad>,
                    errorElement: <div className="min-h-screen flex items-center justify-center bg-white p-4">
                        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md border border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Error Loading Product Upload Page</h2>
                            <p className="text-gray-600 mb-4">
                                There was a problem loading the product upload functionality. This could be due to:
                            </p>
                            <ul className="list-disc pl-5 text-gray-600 mb-4">
                                <li className="mb-2">A connection issue with the server</li>
                                <li className="mb-2">Your session may have expired</li>
                                <li>You might not have the required permissions</li>
                            </ul>
                            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                <button onClick={() => window.location.reload()} 
                                    className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-all">
                                    Try Again
                                </button>
                                <button onClick={() => window.location.href = '/dashboard/admin'} 
                                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-all">
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                },
                {
                    path:"product",
                    element:<LazyLoad><AdminPermission><ProductAdmin/></AdminPermission></LazyLoad>
                },
                {
                    path:"bundle-admin",
                    element:<LazyLoad><AdminPermission><BundleAdmin/></AdminPermission></LazyLoad>
                },
                {
                    path:"orders-admin",
                    element:<LazyLoad><AdminPermission><AdminOrderDashboard/></AdminPermission></LazyLoad>
                },
                {
                    path:"user-management",
                    element:<LazyLoad><AdminPermission><UserManagement/></AdminPermission></LazyLoad>
                },
                {
                    path:"payment-management",
                    element:<LazyLoad><AdminPermission><PaymentManagement/></AdminPermission></LazyLoad>
                },
                {
                    path:"cancellation-management",
                    element:<LazyLoad><AdminPermission><CancellationManagementPage/></AdminPermission></LazyLoad>
                },
                {
                    path:"return-management",
                    element:<LazyLoad><AdminPermission><AdminReturnManagement/></AdminPermission></LazyLoad>
                },
                {
                    path:"custom-tshirt-admin",
                    element:<LazyLoad><AdminPermission><CustomTshirtRequestsAdmin/></AdminPermission></LazyLoad>
                },
                {
                    path:"cancellation-policy",
                    element:<LazyLoad><AdminPermission><CancellationPolicyPage/></AdminPermission></LazyLoad>
                },
                {
                    path:"admin/refund-management",
                    element:<LazyLoad><AdminPermission><RefundManagementPage/></AdminPermission></LazyLoad>
                },
                {
                    path:"stock-management",
                    element:<LazyLoad><AdminPermission><StockManagementPage/></AdminPermission></LazyLoad>
                },
                {
                    path:"inventory/:productId",
                    element:<LazyLoad><AdminPermission><InventoryManagement/></AdminPermission></LazyLoad>
                },
                {
                    path:"inventory-management/:productId",
                    element:<LazyLoad><AdminPermission><InventoryManagement/></AdminPermission></LazyLoad>
                },
                {
                    path:"contact-management",
                    element:<LazyLoad><AdminPermission><AdminContactManagement/></AdminPermission></LazyLoad>
                },
                {
                    path:"*",
                    element:<LazyLoad><PageNotFound/></LazyLoad>
                }
            ]
            },
            {
                path:"category/:category",
                element :<LazyLoad><ProductListPage/></LazyLoad>
            },{
                path:"product/:product",
                element :<LazyLoad><ProductDisplayPage /></LazyLoad>
            },
            {
                path : 'cart',
                element : <LazyLoad><CartMobile/></LazyLoad>
            },
            {
                path:"checkout/bag",
                element: <LazyLoad><BagPage/></LazyLoad>
            },
            {
                path:"checkout/address",
                element: <LazyLoad><AddressPage/></LazyLoad>
            },
            {
                path:"checkout/payment",
                element: <LazyLoad><PaymentPage/></LazyLoad>
            },
            {
                path:"checkout",
                element: <LazyLoad><BagPage/></LazyLoad>
            },
            {
                path:"success",
                element : <LazyLoad><Success/></LazyLoad>
            },
            {
                path:"cancel",
                element : <LazyLoad><Cancel/></LazyLoad>
            },
            {
                path:"order-success",
                element : <LazyLoad><OrderSuccessPage/></LazyLoad>
            },
            {
                path:"delivery-charge-calculator",
                element : <LazyLoad><DeliveryChargeCalculator/></LazyLoad>
            },
            {
                path:"bundle-offers",
                element : <LazyLoad><BundleOffers/></LazyLoad>
            },
            {
                path:"bundle/:bundleId",
                element : <LazyLoad><BundleDetail/></LazyLoad>
            },
            {
                path:"*",
                element : <LazyLoad><PageNotFound/></LazyLoad>
            }
        ]
    }
])

export default router;