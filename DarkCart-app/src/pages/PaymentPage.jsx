import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { DisplayPriceInRupees } from "../utils/DisplayPriceInRupees";
import { useGlobalContext } from "../provider/GlobalProvider";
import Axios from "../utils/Axios";
import SummaryApi from "../common/SummaryApi";
import toast from "react-hot-toast";
import AxiosTostError from "../utils/AxiosTostError";
import Logo from "../assets/logo.png";
import noCart from "../assets/Empty-cuate.png"; // Import fallback image
import ErrorBoundary from "../components/ErrorBoundary";
import ProductImageLink from "../components/ProductImageLink";
import RandomCategoryProducts from "../components/RandomCategoryProducts";

// Import payment icons
import {
  FaCreditCard,
  FaWallet,
  FaMoneyBillWave,
  FaPaypal,
  FaCcVisa,
  FaCcMastercard,
  FaCcAmex,
} from "react-icons/fa";

// Helper function to safely access product and bundle properties
const getProductProperty = (item, propertyPath, fallback = "") => {
  try {
    if (!item) return fallback;
    
    // Handle different potential structures for both products and bundles
    const paths = [
      // If product is directly on the item
      `product.${propertyPath}`,
      // If product is in productId field
      `productId.${propertyPath}`,
      // If bundle is in bundleId field
      `bundleId.${propertyPath}`,
      // Direct property on the item
      propertyPath
    ];
    
    for (const path of paths) {
      const value = path.split('.').reduce((obj, key) => {
        // Handle array index notation like "image[0]"
        if (key.includes('[') && key.includes(']')) {
          const arrayKey = key.substring(0, key.indexOf('['));
          const indexMatch = key.match(/\[(\d+)\]/);
          if (indexMatch && obj && obj[arrayKey] && Array.isArray(obj[arrayKey])) {
            const index = parseInt(indexMatch[1]);
            return obj[arrayKey][index];
          }
          return undefined;
        }
        return obj && obj[key] !== undefined ? obj[key] : undefined;
      }, item);
      
      if (value !== undefined) return value;
    }
    
    return fallback;
  } catch (error) {
    console.log(`Error accessing ${propertyPath}:`, error);
    return fallback;
  }
};

const PaymentPage = () => {
  const { fetchCartItems, handleOrder } = useGlobalContext();
  const cartItemsList = useSelector((state) => state.cartItem.cart);
  // REMOVED: const addressList = useSelector((state) => state.addresses.addressList);
  // We do NOT use Redux addressList - only use address passed from AddressPage
  const user = useSelector((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  // Get selected items from sessionStorage (set in BagPage)
  const [selectedCartItemIds, setSelectedCartItemIds] = useState([]);
  const [checkoutItems, setCheckoutItems] = useState([]);

  // Get selected address and delivery charge from location state
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(0);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('online'); // Default to online payment
  const [isProcessing, setIsProcessing] = useState(false);
  const [deliveryDates, setDeliveryDates] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState(null); // Store payment config (live/test mode)
  
  // Preserve the original location.state to prevent loss on re-render
  const [preservedLocationState, setPreservedLocationState] = useState(null);

  // Helper function to map payment method codes to backend-expected names
  const getPaymentMethodName = (methodCode) => {
    const methodMapping = {
      'online': 'Online Payment',
    };
    return methodMapping[methodCode] || 'Online Payment';
  };

  // Get selected items from sessionStorage and filter cart items
  useEffect(() => {
    const selectedIds = JSON.parse(sessionStorage.getItem('selectedCartItems') || '[]');
    setSelectedCartItemIds(selectedIds);
    
    // First try to get full cart items data from sessionStorage
    const storedCartItems = JSON.parse(sessionStorage.getItem('selectedCartItemsData') || '[]');
    
    if (storedCartItems && storedCartItems.length > 0) {
      // Use the full data stored from BagPage if available
      console.log("PaymentPage: Using stored cart items data from BagPage:", storedCartItems);
      setCheckoutItems(storedCartItems);
    } else {
      // Fallback to filtering from Redux store
      console.log("PaymentPage: Fallback: Filtering cart items from Redux store");
      const itemsToCheckout = cartItemsList.filter(item => selectedIds.includes(item._id));
      setCheckoutItems(itemsToCheckout);
    }
  }, [cartItemsList]);

  // Function to calculate item pricing consistently
  const calculateItemPricing = (item) => {
    let productTitle = 'Item';
    let originalPrice = 0;
    let finalPrice = 0;
    let discount = 0;
    let isBundle = false;
    let quantity = item.quantity || 1;
    
    if (item.productId && item.productId._id) {
      productTitle = item.productId.name || 'Product';
      
      // Check if there's a size-adjusted price first
      if (item.sizeAdjustedPrice) {
        originalPrice = Number(item.sizeAdjustedPrice) || 0;
        console.log(`Using size-adjusted price for ${item.productId.name}: ₹${originalPrice} (Size: ${item.size})`);
      } else {
        originalPrice = Number(item.productId.price) || 0;
      }
      
      discount = item.productId.discount || 0;
      finalPrice = discount > 0 ? originalPrice * (1 - discount/100) : originalPrice;
      isBundle = false;
    } else if (item.bundleId && item.bundleId._id) {
      productTitle = item.bundleId.title || 'Bundle';
      originalPrice = item.bundleId.originalPrice || 0;
      finalPrice = item.bundleId.bundlePrice || 0;
      discount = 0;
      isBundle = true;
    } else {
      productTitle = item.title || item.name || 'Item';
      
      if (item.bundlePrice || item.title) {
        isBundle = true;
        originalPrice = item.originalPrice || 0;
        finalPrice = item.bundlePrice || item.price || 0;
        discount = 0;
      } else {
        isBundle = false;
        originalPrice = item.price || 0;
        discount = item.discount || 0;
        finalPrice = discount > 0 ? originalPrice * (1 - discount/100) : originalPrice;
      }
    }
    
    return {
      productTitle,
      originalPrice,
      finalPrice,
      discount,
      isBundle,
      quantity,
      totalPrice: finalPrice * quantity,
      totalOriginalPrice: originalPrice * quantity
    };
  };

  // Calculate totals for selected items only
  const selectedTotals = checkoutItems.reduce((totals, item) => {
    const pricing = calculateItemPricing(item);
    return {
      totalQty: totals.totalQty + pricing.quantity,
      totalPrice: totals.totalPrice + pricing.totalPrice,
      totalOriginalPrice: totals.totalOriginalPrice + pricing.totalOriginalPrice
    };
  }, { totalQty: 0, totalPrice: 0, totalOriginalPrice: 0 });

  // Extract values for easier use in JSX
  const totalQty = selectedTotals.totalQty;
  const totalPrice = selectedTotals.totalPrice;
  const notDiscountTotalPrice = selectedTotals.totalOriginalPrice;

  // Fetch payment configuration on mount
  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        const response = await Axios({
          ...SummaryApi.getPaymentConfig
        });
        
        if (response.data.success) {
          setPaymentConfig(response.data.data);
          if (response.data.data.isLiveMode) {
            console.log('💳 Payment mode: LIVE (Real transactions)');
          } else {
            console.log('💳 Payment mode: TEST');
          }
        }
      } catch (error) {
        console.error('Failed to fetch payment config:', error);
        // Don't block user, just log the error
      }
    };
    
    fetchPaymentConfig();
  }, []);

  // Get data from sessionStorage (primary) or location state (fallback)
  // CRITICAL: Load and preserve address data ONCE
  useEffect(() => {
    // Only process if we haven't preserved the state yet
    if (preservedLocationState) {
      return;
    }
    
    // Try to get address data from sessionStorage first (most reliable)
    let addressData = null;
    const storedData = sessionStorage.getItem('checkoutAddressData');
    
    if (storedData) {
      try {
        addressData = JSON.parse(storedData);
      } catch (e) {
        // Silent fail - data will be null
      }
    }
    
    // Fallback to location.state if sessionStorage doesn't have data
    if (!addressData && location.state?.selectedAddressId) {
      addressData = location.state;
    }
    
    // Validate we have address data
    if (!addressData?.selectedAddressId || addressData?.deliveryCharge === undefined) {
      toast.error('Please select a delivery address');
      navigate('/checkout/address', { replace: true });
      return;
    }
    
    // CRITICAL: Must have the full address object
    if (!addressData.selectedAddress) {
      toast.error('Address data incomplete. Please select again.');
      navigate('/checkout/address', { replace: true });
      return;
    }
    
    // Verify the address ID matches
    if (addressData.selectedAddress._id !== addressData.selectedAddressId) {
      toast.error('Address data mismatch. Please select again.');
      navigate('/checkout/address', { replace: true });
      return;
    }
    
    // Preserve the data
    setPreservedLocationState(addressData);
    
    // Set all state variables with the address data
    setSelectedAddressId(addressData.selectedAddressId);
    setSelectedAddress(addressData.selectedAddress); // Use EXACT address
    setDeliveryCharge(addressData.deliveryCharge);
    setDeliveryDistance(addressData.deliveryDistance || 0);
    setEstimatedDeliveryDate(addressData.estimatedDeliveryDate || '');
    setDeliveryDays(addressData.deliveryDays || 0);
  }, [location, navigate, preservedLocationState]);
  
  // WATCHDOG: Continuously verify address integrity
  useEffect(() => {
    if (selectedAddress && selectedAddressId) {
      if (selectedAddress._id !== selectedAddressId) {
        toast.error('Address verification failed. Redirecting...');
        setTimeout(() => {
          navigate('/checkout/address', { replace: true });
        }, 2000);
      }
    }
  }, [selectedAddress, selectedAddressId, navigate]);
  
  // Cleanup: Remove address data from sessionStorage when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  // Set delivery dates for products using the estimated delivery date from AddressPage
  useEffect(() => {
    try {
      if (checkoutItems && checkoutItems.length > 0) {
        if (estimatedDeliveryDate) {
          // Use the estimated delivery date from AddressPage for all items
          const deliveryEstimates = checkoutItems.map((item, idx) => {
            // Get a unique ID for each item
            const itemId = item?._id || 
                          item?.productId?._id || 
                          `temp-${idx}-${Math.random().toString(36).substr(2, 9)}`;
            
            return {
              productId: itemId,
              deliveryDate: estimatedDeliveryDate, // Use the date from AddressPage
              formattedDate: estimatedDeliveryDate // Already formatted in AddressPage
            };
          });
          
          setDeliveryDates(deliveryEstimates);
        } else {
          // Fallback: Calculate delivery dates if estimatedDeliveryDate is not available
          const today = new Date();
          const deliveryEstimates = checkoutItems.map((item, idx) => {
            // Default delivery estimate: 3-5 days
            const deliveryDays = Math.floor(Math.random() * 3) + 3;
            const deliveryDate = new Date(today);
            deliveryDate.setDate(today.getDate() + deliveryDays);
            
            // Get a unique ID for each item
            const itemId = item?._id || 
                          item?.productId?._id || 
                          `temp-${idx}-${Math.random().toString(36).substr(2, 9)}`;
            
            return {
              productId: itemId,
              deliveryDate: deliveryDate,
              formattedDate: `${deliveryDate.getDate()} ${deliveryDate.toLocaleString('default', { month: 'short' })} ${deliveryDate.getFullYear()}`
            };
          });
          
          setDeliveryDates(deliveryEstimates);
        }
      } else {
        // Reset delivery dates if no items
        setDeliveryDates([]);
      }
    } catch (error) {
      console.error("Error setting delivery dates:", error);
      
      // Set fallback dates in case of error
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 5); // Default 5-day delivery
      
      const fallbackEstimates = Array(checkoutItems?.length || 0).fill().map((_, i) => ({
        productId: `fallback-${i}`,
        deliveryDate: fallbackDate,
        formattedDate: `${fallbackDate.getDate()} ${fallbackDate.toLocaleString('default', { month: 'short' })} ${fallbackDate.getFullYear()}`
      }));
      
      setDeliveryDates(fallbackEstimates);
    }
  }, [checkoutItems, estimatedDeliveryDate]);

  const handlePlaceOrder = async () => {
    // Validate selection
    if (!selectedAddressId) {
      toast.error("Please select an address");
      navigate('/checkout/address');
      return;
    }
    
    if (!selectedAddress) {
      toast.error("Address details not found. Please select again.");
      navigate('/checkout/address');
      return;
    }

    // Check if there are selected items to checkout
    if (checkoutItems.length === 0) {
      toast.error("No items selected for checkout");
      navigate('/checkout/bag');
      return;
    }

    setIsProcessing(true);

    try {
      // Show a loading toast
      toast.loading("Processing your order...", {
        id: "order-processing",
      });

      // Make sure items are properly formatted for the API
      const preparedItems = checkoutItems.map(item => {
        // Calculate pricing for this item using our pricing function
        const itemPricing = calculateItemPricing(item);
        
        // Include complete product details for orders
        if (item.itemType === 'bundle') {
          return {
            _id: item._id,
            bundleId: typeof item.bundleId === 'object' ? item.bundleId._id : item.bundleId,
            bundleDetails: typeof item.bundleId === 'object' ? {
              title: item.bundleId.title,
              // Handle both single image and images array
              image: item.bundleId.image || (item.bundleId.images && item.bundleId.images.length > 0 ? item.bundleId.images[0] : ''),
              images: item.bundleId.images || [],
              bundlePrice: item.bundleId.bundlePrice
            } : undefined,
            itemType: 'bundle',
            quantity: item.quantity || 1,
            // Include pricing information
            price: itemPricing.finalPrice,
            originalPrice: itemPricing.originalPrice,
            discount: itemPricing.discount,
            totalItemPrice: itemPricing.totalPrice
          };
        } else {
          return {
            _id: item._id,
            productId: typeof item.productId === 'object' ? item.productId._id : item.productId,
            productDetails: typeof item.productId === 'object' ? {
              name: item.productId.name,
              image: item.productId.image,
              price: itemPricing.finalPrice, // Use calculated price
              originalPrice: itemPricing.originalPrice,
              sizes: item.productId.sizes,
              sizePricing: item.productId.sizePricing
            } : undefined,
            size: item.size, // Include size information for product items
            sizeAdjustedPrice: item.sizeAdjustedPrice, // Include size-specific price if available
            itemType: 'product',
            quantity: item.quantity || 1,
            // Include pricing information
            price: itemPricing.finalPrice,
            originalPrice: itemPricing.originalPrice,
            discount: itemPricing.discount,
            totalItemPrice: itemPricing.totalPrice
          };
        }
      });

      // Prepare order data for backend
      const orderPayload = {
        list_items: preparedItems, // Send properly formatted items
        totalAmount: totalPrice + deliveryCharge,
        addressId: selectedAddressId,
        subTotalAmt: totalPrice,
        deliveryCharge: deliveryCharge,
        deliveryDistance: deliveryDistance,
        estimatedDeliveryDate: estimatedDeliveryDate,
        deliveryDays: deliveryDays,
        quantity: totalQty,
        paymentMethod: getPaymentMethodName(selectedPaymentMethod), // Add payment method
      };
      
      // Step 1: Create order in backend
      const response = await Axios({
        ...SummaryApi.onlinePaymentOrder,
        data: orderPayload,
        timeout: 30000 // Add timeout to prevent hanging requests
      });

      const { data: responseData } = response;

      if (!responseData.success) {
        toast.dismiss("order-processing");
        toast.error(responseData.message || "Failed to create order");
        setIsProcessing(false);
        return;
      }

      const orderData = responseData.data;
      const ourOrderId = orderData.orderId;

      console.log("Order created:", ourOrderId);

      // Step 2: Create Razorpay order
      const razorpayOrderResponse = await Axios({
        ...SummaryApi.createRazorpayOrder,
        data: {
          amount: totalPrice + deliveryCharge,
          currency: 'INR',
          orderId: ourOrderId
        }
      });

      if (!razorpayOrderResponse.data.success) {
        toast.dismiss("order-processing");
        toast.error("Failed to initialize payment gateway");
        setIsProcessing(false);
        return;
      }

      const razorpayOrderId = razorpayOrderResponse.data.data.id;

      toast.dismiss("order-processing");

      // Step 3: Open Razorpay checkout
      const options = {
        key: paymentConfig?.razorpayKeyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: (totalPrice + deliveryCharge) * 100, // Amount in paise
        currency: 'INR',
        name: 'Casual Clothings',
        description: `Order #${ourOrderId}`,
        order_id: razorpayOrderId,
        handler: async function (response) {
          try {
            toast.loading("Verifying payment...", { id: "payment-verify" });

            // Verify payment
            const verifyResponse = await Axios({
              ...SummaryApi.verifyRazorpayPayment,
              data: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: ourOrderId
              }
            });

            toast.dismiss("payment-verify");

            if (verifyResponse.data.success) {
              toast.success("Payment successful!");
              
              // Remove selected items and address data from sessionStorage
              sessionStorage.removeItem('selectedCartItems');
              sessionStorage.removeItem('selectedCartItemsData');
              sessionStorage.removeItem('checkoutAddressData');
              
              // Refresh cart
              setTimeout(() => {
                fetchCartItems();
              }, 1000);
              
              handleOrder();
              navigate("/order-success", {
                state: {
                  text: "Order",
                  orderDetails: {
                    estimatedDeliveryDate: estimatedDeliveryDate,
                    deliveryDays: deliveryDays,
                    deliveryDistance: deliveryDistance,
                    totalAmount: totalPrice + deliveryCharge,
                    itemCount: totalQty
                  }
                },
              });
            } else {
              toast.error("Payment verification failed");
            }
          } catch (verifyError) {
            console.error("Payment verification error:", verifyError);
            toast.dismiss("payment-verify");
            toast.error("Payment verification failed. Please contact support.");
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: selectedAddress?.name || user?.name || '',
          email: user?.email || '',
          contact: selectedAddress?.mobile || user?.mobile || ''
        },
        notes: {
          orderId: ourOrderId
        },
        theme: {
          color: '#000000'
        },
        modal: {
          ondismiss: function() {
            toast.dismiss("order-processing");
            toast.error("Payment cancelled");
            setIsProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response) {
        console.error("Payment failed:", response.error);
        toast.error(`Payment failed: ${response.error.description}`);
        setIsProcessing(false);
      });
      
      rzp.open();

    } catch (error) {
      console.error("Order placement error:", error);
      toast.dismiss("order-processing");
      
      if (error.code === 'ECONNABORTED') {
        toast.error("The request timed out. Please try again.");
      } else if (error.response && error.response.data && error.response.data.message) {
        toast.error(error.response.data.message);
      } else {
        AxiosTostError(error);
      }
      
      // Add fallback error message if AxiosTostError doesn't show anything
      setTimeout(() => {
        const toastElements = document.querySelectorAll('[data-id^="toast-"]');
        if (toastElements.length === 0) {
          toast.error("Failed to place order. Please try again.");
        }
      }, 300);
      
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section with stepper */}
      <div className="bg-black shadow-md border-b text-white">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="w-20 sm:w-24">
              <Link to="/">
                <img src={Logo} alt="casualclothings Logo" className="h-8 sm:h-10" />
              </Link>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-3">
              <div className="text-3xs sm:text-xs uppercase tracking-wider md:tracking-widest font-medium text-gray-300">
                <Link to="/checkout/bag" className="hover:text-white transition-colors">BAG</Link>
              </div>
              <div className="w-3 sm:w-8 h-px bg-gray-600"></div>
              <div className="text-3xs sm:text-xs uppercase tracking-wider md:tracking-widest font-medium text-gray-300">
                <Link to="/checkout/address" className="hover:text-white transition-colors">ADDRESS</Link>
              </div>
              <div className="w-3 sm:w-8 h-px bg-gray-600"></div>
              <div className="text-3xs sm:text-xs uppercase tracking-wider md:tracking-widest font-medium text-white">PAYMENT</div>
            </div>
            <div className="w-20 sm:w-24">
              {/* Placeholder for balance */}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Payment Options */}
          <div className="lg:col-span-2">
            {/* Payment Methods Section */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="p-4 sm:p-5 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-medium tracking-tight uppercase">Select Payment Method</h2>
                  {paymentConfig && paymentConfig.isLiveMode && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      LIVE MODE
                    </span>
                  )}
                  {paymentConfig && !paymentConfig.isLiveMode && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      TEST MODE
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-4 sm:p-5">
                {/* Payment Methods List */}
                <div className="space-y-4">
                  {/* Online Payment - Default Selected */}
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div 
                      className={`p-4 flex items-center cursor-pointer ${
                        selectedPaymentMethod === 'online' ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => setSelectedPaymentMethod('online')}
                    >
                      <input
                        type="radio"
                        id="payment-online"
                        name="payment-method"
                        checked={selectedPaymentMethod === 'online'}
                        onChange={() => setSelectedPaymentMethod('online')}
                        className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                      />
                      <label htmlFor="payment-online" className="ml-3 flex items-center cursor-pointer">
                        <FaCreditCard className="text-gray-700 mr-2" />
                        <span className="font-medium text-gray-900">Online Payment</span>
                      </label>
                    </div>
                    
                    {selectedPaymentMethod === 'online' && (
                      <div className="p-4 border-t bg-gray-50">
                        <p className="text-xs sm:text-sm text-gray-600">
                          Pay securely using your credit/debit card, net banking, or UPI.
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-2">
                          Your payment information is encrypted and secure.
                        </p>
                      </div>
                    )}
                  </div>

                

                  {/* UPI */}
                

                  {/* Net Banking */}
                

                  <div className="text-xs sm:text-sm text-gray-600 mt-4">
                    <p>
                      All payments are processed securely. Your card details are never stored on our servers.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Address Display */}
            {selectedAddress && (
              <div className="bg-white rounded-lg shadow-md mb-6">
                <div className="p-4 sm:p-5 border-b">
                  <h2 className="text-base sm:text-lg font-medium tracking-tight uppercase">Delivery Address</h2>
                  {selectedAddress._id !== selectedAddressId && (
                    <div className="mt-2 p-3 bg-red-100 border-2 border-red-500 text-red-800 text-sm rounded font-semibold">
                      🚨 CRITICAL ERROR: Address ID mismatch!
                      <button 
                        onClick={() => navigate('/checkout/address')} 
                        className="mt-2 ml-3 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Go Back
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  {/* Confirmation badge */}
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    ✓ Confirmed delivery address
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="font-medium tracking-tight text-sm sm:text-base text-gray-900">{selectedAddress.address_line}</span>
                        {selectedAddress.addressType === 'HOME' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs sm:text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            HOME
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2">
                        {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                      </div>
                      
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">
                        Mobile: {selectedAddress.mobile}
                      </div>
                    </div>

                    <Link 
                      to="/checkout/address" 
                      className="text-xs sm:text-sm text-gray-700 font-medium hover:text-black"
                    >
                      Change
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column */}
          <div className="lg:col-span-1">
            {/* Product Images with Details */}
            <div className="bg-white rounded-lg shadow-md mb-4">
              <div className="p-4 sm:p-5 border-b">
                <h2 className="text-base sm:text-lg font-medium tracking-tight uppercase">Your Items ({totalQty})</h2>
              </div>
              <div className="p-4 sm:p-5">
                <div className="space-y-4">
                  {checkoutItems.map((item, index) => {
                    // Use our safe access helper to get all needed properties
                    const itemId = getProductProperty(item, '_id', `item-${index}`);
                    const deliveryInfo = deliveryDates.find(d => d.productId === itemId);
                    const pricing = calculateItemPricing(item); // Use consistent pricing function
                    
                    // Get image source safely - handle both products and bundles
                    let imageSrc = noCart;
                    if (item.productId && item.productId._id) {
                      imageSrc = item.productId.image?.[0] || item.productId.primaryImage || noCart;
                    } else if (item.bundleId && item.bundleId._id) {
                      imageSrc = item.bundleId.images?.[0] || item.bundleId.image || noCart;
                    } else {
                      imageSrc = item.image?.[0] || item.images?.[0] || item.primaryImage || item.image || noCart;
                    }
                    
                    const size = getProductProperty(item, 'size', 'Standard');
                    
                    return (
                      <div 
                        key={`preview-item-${index}`} 
                        className="flex items-start border-b pb-3 last:border-b-0 last:pb-0"
                      >
                        {/* Product Image */}
                        <div className="w-16 h-16 flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden">
                          {item.productId?._id ? (
                            <ProductImageLink 
                              imageUrl={imageSrc}
                              productId={item.productId._id}
                              alt={pricing.productTitle}
                              className="w-full h-full"
                              height="100%"
                              width="100%"
                            />
                          ) : item.bundleId?._id ? (
                            <ProductImageLink 
                              imageUrl={imageSrc}
                              productId={item.bundleId._id}
                              alt={pricing.productTitle}
                              className="w-full h-full"
                              height="100%"
                              width="100%"
                              disableNavigation={true} // Disable for bundles, or create a separate handler
                            />
                          ) : (
                            <img 
                              src={imageSrc}
                              alt={pricing.productTitle}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = noCart;
                              }}
                            />
                          )}
                        </div>
                        
                        {/* Item Details */}
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium line-clamp-1" title={pricing.productTitle}>
                            {pricing.productTitle}
                            {pricing.isBundle && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Bundle
                              </span>
                            )}
                          </h3>
                          
                          <div className="flex flex-wrap text-xs text-gray-500 mt-1">
                            <span className="mr-2">
                              Size: <span className="font-semibold">{size}</span>
                              {item.sizeAdjustedPrice && item.sizeAdjustedPrice !== item.productId?.price && (
                                <span className="ml-1 text-green-600 font-medium">
                                  (Size-specific price: {DisplayPriceInRupees(item.sizeAdjustedPrice)})
                                </span>
                              )}
                            </span>
                            <span>Qty: {pricing.quantity}</span>
                          </div>
                          
                          <div className="mt-1 flex items-center">
                            <span className="font-medium text-sm">
                              {DisplayPriceInRupees(pricing.totalPrice)}
                            </span>
                            {/* Only show discount for products, not bundles */}
                            {!pricing.isBundle && pricing.discount > 0 && (
                              <>
                                <span className="mx-1 text-xs line-through text-gray-400">
                                  {DisplayPriceInRupees(pricing.totalOriginalPrice)}
                                </span>
                                <span className="text-xs text-green-600">
                                  {pricing.discount}% OFF
                                </span>
                              </>
                            )}
                            {/* Show size adjustment indicator if available */}
                            {item.sizeAdjustedPrice && item.size && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-medium bg-gray-100 text-gray-700">
                                Price adjusted for size
                              </span>
                            )}
                          </div>
                          
                          {/* <div className="mt-1">
                            <span className="text-xs text-red-700 font-medium">
                              Delivery by {deliveryInfo?.formattedDate || 'Next Week'}
                            </span>
                          </div> */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Price Details */}
            <div className="bg-white rounded-lg shadow-md sticky top-4">
              <div className="p-4 sm:p-5 border-b">
                <h2 className="text-base sm:text-lg font-medium tracking-tight uppercase">PRICE DETAILS ({totalQty} {totalQty === 1 ? 'Item' : 'Items'})</h2>
              </div>
              
              <div className="p-4 sm:p-5">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 text-sm sm:text-base">Total MRP</span>
                    <span className="text-gray-900 text-sm sm:text-base">₹{notDiscountTotalPrice.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 text-sm sm:text-base">Discount on MRP</span>
                    <span className="text-gray-900 text-sm sm:text-base">-₹{(notDiscountTotalPrice - totalPrice).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 text-sm sm:text-base">Platform Fee</span>
                    <div className="flex items-center">
                      <span className="line-through text-gray-500 mr-1 text-sm">₹99</span>
                      <span className="text-gray-900 text-sm sm:text-base">FREE</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 text-sm sm:text-base">Delivery Charge</span>
                    <span className="text-gray-900 text-sm sm:text-base">{deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE'}</span>
                  </div>
                  
                  {estimatedDeliveryDate && (
                    <div className="flex justify-between items-center py-2 bg-gray-50 px-3 rounded-md mt-2 border border-gray-200">
                      <span className="text-gray-800 font-medium text-sm">Estimated Delivery</span>
                      <div className="text-right">
                        <div className="text-gray-900 font-semibold text-sm">{estimatedDeliveryDate}</div>
                        {deliveryDays && (
                          <div className="text-xs text-gray-600">
                            ({deliveryDays} {deliveryDays === 1 ? 'day' : 'days'})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-900 text-base sm:text-lg tracking-tight">Total Amount</span>
                      <span className="text-gray-900 text-base sm:text-lg">₹{(totalPrice + deliveryCharge).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || !selectedPaymentMethod}
                  className="w-full bg-black hover:bg-gray-900 text-white py-3.5 mt-6 font-medium text-sm sm:text-base disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 tracking-wide uppercase"
                >
                  {isProcessing ? "PROCESSING PAYMENT..." : "PAY NOW"}
                </button>
                
                <div className="mt-6 text-xs sm:text-sm text-center text-gray-600 space-y-1">
                  <p className="font-medium tracking-tight">Safe and Secure Payments. Easy returns.</p>
                  <p className="tracking-tight">100% Authentic products.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recommended Products Section */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-8">
        <RandomCategoryProducts 
          title="You Might Also Like" 
          limit={6}
        />
      </div>
    </div>
  );
};

// Wrap with ErrorBoundary for better error handling
const PaymentPageWithErrorBoundary = () => (
  <ErrorBoundary>
    <PaymentPage />
  </ErrorBoundary>
);

export default PaymentPageWithErrorBoundary;
