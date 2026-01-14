import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { DisplayPriceInRupees } from "../utils/DisplayPriceInRupees";
import { useGlobalContext } from "../provider/GlobalProvider";
import AddAddress from "../components/AddAddress";
import AxiosTostError from "../utils/AxiosTostError";
import Axios from "../utils/Axios";
import SummaryApi from "../common/SummaryApi";
import noCart from "../assets/Empty-cuate.png"; // Import fallback image
import toast from "react-hot-toast";
import EditAddressData from "../components/EditAddressData";
import Logo from "../assets/logo.png";
import ErrorBoundary from "../components/ErrorBoundary";
import ProductImageLink from "../components/ProductImageLink";
import RandomCategoryProducts from "../components/RandomCategoryProducts";

// Helper function to safely access product properties
const getProductProperty = (item, propertyPath, fallback = "") => {
  try {
    if (!item) return fallback;
    
    // Handle different potential structures
    const paths = [
      // If product is directly on the item
      `product.${propertyPath}`,
      // If product is in productId field
      `productId.${propertyPath}`,
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

// Function to calculate item pricing consistently (similar to CheckoutPage)
const calculateItemPricing = (item) => {
  let productTitle = 'Item';
  let originalPrice = 0;
  let finalPrice = 0;
  let discount = 0;
  let isBundle = false;
  let quantity = item.quantity || 1;
  
  if (item.productId && item.productId._id) {
    // It's a product - discount applies
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
    // It's a bundle - NO DISCOUNT
    productTitle = item.bundleId.title || 'Bundle';
    originalPrice = item.bundleId.originalPrice || 0;
    finalPrice = item.bundleId.bundlePrice || 0;
    discount = 0; // Force discount to 0 for bundles
    isBundle = true;
  } else {
    // Fallback: check if item itself has properties
    productTitle = item.title || item.name || 'Item';
    
    // Check if it's a bundle based on field names
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

const AddressPage = () => {
  const { fetchCartItems, handleOrder, fetchAddress } = useGlobalContext();
  const [openAddAddress, setOpenAddAddress] = useState(false);
  
  // Get addresses from Redux store
  const reduxAddressList = useSelector((state) => state.addresses.addressList);
  
  // Create a local copy for immediate UI updates
  const [localAddressList, setLocalAddressList] = useState([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(null);
  const cartItemsList = useSelector((state) => state.cartItem.cart);
  const navigate = useNavigate();

  // Get selected items from sessionStorage (set in BagPage)
  const [selectedCartItemIds, setSelectedCartItemIds] = useState([]);
  const [checkoutItems, setCheckoutItems] = useState([]);

  useEffect(() => {
    const selectedIds = JSON.parse(sessionStorage.getItem('selectedCartItems') || '[]');
    setSelectedCartItemIds(selectedIds);
    
    // First try to get full cart items data from sessionStorage
    const storedCartItems = JSON.parse(sessionStorage.getItem('selectedCartItemsData') || '[]');
    
    if (storedCartItems && storedCartItems.length > 0) {
      // Use the full data stored from BagPage if available
      console.log("Using stored cart items data from BagPage:", storedCartItems);
      setCheckoutItems(storedCartItems);
    } else {
      // Fallback to filtering from Redux store
      console.log("Fallback: Filtering cart items from Redux store");
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

  // Keep local address list in sync with Redux
  useEffect(() => {
    console.log('AddressPage: Syncing localAddressList with Redux:', {
      reduxCount: reduxAddressList.length,
      reduxAddresses: reduxAddressList.map(addr => ({
        _id: addr._id,
        address_line: addr.address_line,
        city: addr.city
      }))
    });
    setLocalAddressList(reduxAddressList);
  }, [reduxAddressList]);
  
  // Use the local address list for rendering
  const addressList = localAddressList;
  
  // Debug: Log whenever addressList changes
  useEffect(() => {
    console.log('AddressPage: addressList updated:', {
      count: addressList.length,
      addresses: addressList.map(addr => ({
        _id: addr._id,
        address_line: addr.address_line
      }))
    });
  }, [addressList]);

  // State for edit address functionality
  const [editAddressData, setEditAddressData] = useState(null);
  const [openEditAddress, setOpenEditAddress] = useState(false);

  // Delivery charge calculation states
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [isCalculatingDelivery, setIsCalculatingDelivery] = useState(false);
  const [deliveryDistance, setDeliveryDistance] = useState(null);
  const [isDeliveryCalculated, setIsDeliveryCalculated] = useState(false);
  
  // Delivery date calculation states
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(null);
  const [deliveryDays, setDeliveryDays] = useState(null);

  const GEOCODING_API_KEY = "038cafabde4449718e8dc2303a78956f";
  const SHOP_LOCATION = "Tirupur"; // Your shop location (simplified like test.jsx)

  // Function to extract and normalize city/district names for consistent comparison
  const extractAndNormalizeCity = (address) => {
    if (!address || !address.city) return null;
    
    let cityName = address.city.toString().trim();
    
    // Convert to lowercase for processing
    let normalized = cityName.toLowerCase();
    
    // Remove common administrative suffixes that refer to the same place
    normalized = normalized
      .replace(/\s+district$/i, '') // Remove "district" suffix
      .replace(/\s+taluk$/i, '')    // Remove "taluk" suffix  
      .replace(/\s+taluka$/i, '')   // Remove "taluka" suffix
      .replace(/\s+city$/i, '')     // Remove "city" suffix
      .replace(/\s+municipality$/i, '') // Remove "municipality" suffix
      .replace(/\s+corporation$/i, '') // Remove "corporation" suffix
      .replace(/\s+rural$/i, '')    // Remove "rural" suffix
      .replace(/\s+urban$/i, '')    // Remove "urban" suffix
      .trim();
    
    // Handle common variations
    const cityMappings = {
      'tirupur': 'tirupur',
      'thirupur': 'tirupur',
      'tirpur': 'tirupur',
      'tiruppur': 'tirupur',
      'coimbatore': 'coimbatore',
      'kovai': 'coimbatore',
      'chennai': 'chennai',
      'madras': 'chennai',
      'bangalore': 'bangalore',
      'bengaluru': 'bangalore'
    };
    
    // Apply city mappings
    if (cityMappings[normalized]) {
      normalized = cityMappings[normalized];
    }
    
    // Capitalize first letter of each word for display
    const result = normalized.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return result;
  };

  // Delivery charge calculation functions
  const getCoordinates = async (address) => {
    try {
      // Use OpenCage Geocoding API with your API key
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address + ', India')}&key=${GEOCODING_API_KEY}&limit=1&countrycode=in&language=en`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.lat,
          lon: result.geometry.lng,
          display_name: result.formatted,
          confidence: result.confidence
        };
      } else {
        throw new Error(`Location not found: ${address}`);
      }
    } catch (err) {
      // Fallback to Nominatim if OpenCage fails
      console.warn("OpenCage geocoding failed, using Nominatim fallback:", err.message);
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}, India&limit=1&countrycodes=in&addressdetails=1`;
      const response = await fetch(fallbackUrl);
      const data = await response.json();
      
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          display_name: data[0].display_name,
          confidence: 5 // Lower confidence for fallback
        };
      } else {
        throw new Error(`Location not found: ${address}`);
      }
    }
  };

  const getStraightLineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRoadDistance = async (fromLocation, toLocation) => {
    try {
      // Get coordinates using your geocoding API
      const fromCoords = await getCoordinates(fromLocation);
      const toCoords = await getCoordinates(toLocation);

      // Method 1: Use OSRM (Open Source Routing Machine) - most accurate
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=false&alternatives=false&steps=false`;
      
      try {
        const response = await fetch(osrmUrl);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const distanceInMeters = data.routes[0].distance;
          return distanceInMeters / 1000; // Convert to kilometers
        }
      } catch (err) {
        console.log("OSRM failed, trying GraphHopper...");
      }

      // Method 2: Try GraphHopper API as fallback
      const graphHopperUrl = `https://graphhopper.com/api/1/route?point=${fromCoords.lat},${fromCoords.lon}&point=${toCoords.lat},${toCoords.lon}&vehicle=car&locale=en&calc_points=false&key=`;
      
      try {
        const response = await fetch(graphHopperUrl);
        const data = await response.json();
        
        if (data.paths && data.paths.length > 0) {
          const distanceInMeters = data.paths[0].distance;
          return distanceInMeters / 1000; // Convert to kilometers
        }
      } catch (err) {
        console.log("GraphHopper failed, using fallback calculation...");
      }

      // Method 3: Fallback with adjusted straight-line distance
      const straightDistance = getStraightLineDistance(fromCoords.lat, fromCoords.lon, toCoords.lat, toCoords.lon);
      // Apply a road factor of 1.4 to approximate road distance from straight-line
      return straightDistance * 1.4;
      
    } catch (err) {
      throw new Error(`Unable to calculate distance: ${err.message}`);
    }
  };

  // Enhanced delivery charge calculation based on road distance (₹50 for every 80km)
  const getDeliveryChargeFromDistance = (distance) => {
    // Calculate charge: ₹50 for every 80km (or part thereof)
    const chargePerSegment = 50; // ₹50
    const kmPerSegment = 80; // per 80km
    
    // Calculate how many 80km segments (round up for partial segments)
    const segments = Math.ceil(distance / kmPerSegment);
    
    return segments * chargePerSegment;
  };

  // Calculate delivery days based on distance (1 day for every 200km)
  const getDeliveryDaysFromDistance = (distance) => {
    // Base delivery time: 1 day for local delivery
    const baseDays = 1;
    
    // Additional days: 1 day for every 200km
    // Formula: Base days + (distance / 200km) * 1 day
    const daysPerSegment = 1; // 1 day
    const kmPerSegment = 200; // per 200km
    
    // Calculate additional days (round up for partial segments)
    const additionalDays = Math.ceil(distance / kmPerSegment) * daysPerSegment;
    
    return baseDays + additionalDays;
  };

  // Calculate estimated delivery date from days
  const getEstimatedDeliveryDate = (days) => {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);
    
    return {
      date: deliveryDate,
      formattedDate: `${deliveryDate.getDate()} ${deliveryDate.toLocaleString('default', { month: 'short' })} ${deliveryDate.getFullYear()}`
    };
  };

  const calculateDeliveryCharge = async (customerAddress) => {
    if (!customerAddress) {
      setDeliveryCharge(0);
      setDeliveryDistance(null);
      setIsDeliveryCalculated(false);
      setEstimatedDeliveryDate(null);
      setDeliveryDays(null);
      return;
    }

    setIsCalculatingDelivery(true);
    setIsDeliveryCalculated(false);
    
    try {
      // Extract and normalize the customer city/district name
      const normalizedCustomerCity = extractAndNormalizeCity(customerAddress);
      
      if (!normalizedCustomerCity) {
        throw new Error("Unable to extract city from address");
      }
      
      // Early return for same city
      const shopCity = 'tirupur';
      const customerCity = normalizedCustomerCity.toLowerCase();
      
      if (customerCity === shopCity) {
        setDeliveryDistance('0');
        setDeliveryCharge(50); // ₹50 for same place delivery
        
        // Calculate delivery date for same city (1 day)
        const deliveryDaysCount = 1;
        const deliveryDateInfo = getEstimatedDeliveryDate(deliveryDaysCount);
        setDeliveryDays(deliveryDaysCount);
        setEstimatedDeliveryDate(deliveryDateInfo.formattedDate);
        
        setIsDeliveryCalculated(true);
        return;
      }
      
      // Only call API if cities are different
      const roadDistance = await getRoadDistance(SHOP_LOCATION, normalizedCustomerCity);
      const deliveryCharge = getDeliveryChargeFromDistance(roadDistance);
      
      // Calculate delivery days and date based on distance
      const deliveryDaysCount = getDeliveryDaysFromDistance(roadDistance);
      const deliveryDateInfo = getEstimatedDeliveryDate(deliveryDaysCount);
      
      setDeliveryDistance(roadDistance.toFixed(2));
      setDeliveryCharge(deliveryCharge);
      setDeliveryDays(deliveryDaysCount);
      setEstimatedDeliveryDate(deliveryDateInfo.formattedDate);
      setIsDeliveryCalculated(true);
      
    } catch (error) {
      console.error("Error calculating delivery charge:", error);
      setDeliveryCharge(0); // Default to free delivery if calculation fails
      setDeliveryDistance(null);
      setEstimatedDeliveryDate(null);
      setDeliveryDays(null);
      setIsDeliveryCalculated(true); // Still mark as calculated even if failed
    } finally {
      setIsCalculatingDelivery(false);
    }
  };

  // Handle address list changes
  useEffect(() => {
    // If there are no addresses, reset the selected index
    if (!addressList || addressList.length === 0) {
      setSelectedAddressIndex(null);
      setDeliveryCharge(0);
      setDeliveryDistance(null);
      setIsDeliveryCalculated(false);
      return;
    }
    
    // If the selected index is no longer valid after an update, reset it
    if (selectedAddressIndex !== null && selectedAddressIndex >= addressList.length) {
      setSelectedAddressIndex(null);
    }
  }, [addressList]);
  
  // Calculate delivery charge when address is selected
  useEffect(() => {
    // If selected index is null or invalid, reset values
    if (selectedAddressIndex === null || !addressList || !addressList[selectedAddressIndex]) {
      setDeliveryCharge(0);
      setDeliveryDistance(null);
      setIsDeliveryCalculated(false);
      setEstimatedDeliveryDate(null);
      setDeliveryDays(null);
      return;
    }
    
    // Calculate delivery charge for the selected address
    calculateDeliveryCharge(addressList[selectedAddressIndex]);
  }, [selectedAddressIndex, addressList]);
  
  // Fetch addresses when component mounts
  useEffect(() => {
    // Initial fetch
    fetchAddress();
  }, []);
  
  // Debug logging for edit address modal
  useEffect(() => {
    console.log("Edit address modal state:", { 
      open: openEditAddress, 
      data: editAddressData 
    });
  }, [openEditAddress, editAddressData]);

  const handleDeleteAddress = async (addressId) => {
    try {
      console.log("Deleting address with ID:", addressId);
      
      // Handle the selected index before making the API call
      const addressToDeleteIndex = addressList.findIndex(addr => addr._id === addressId);
      if (selectedAddressIndex !== null) {
        if (addressToDeleteIndex === selectedAddressIndex) {
          // If the deleted address was selected, clear the selection
          setSelectedAddressIndex(null);
        } else if (addressToDeleteIndex < selectedAddressIndex) {
          // If an address before the selected one was deleted, adjust the index
          setSelectedAddressIndex(selectedAddressIndex - 1);
        }
      }
      
      // Immediately update local state to reflect the deletion
      setLocalAddressList(prevList => prevList.filter(addr => addr._id !== addressId));
      
      // Simple implementation similar to Address.jsx
      const response = await Axios({
        ...SummaryApi.deleteAddress,
        data: { _id: addressId },
      });
      
      if (response.data.success) {
        toast.success(response.data.message);
        // Fetch fresh address data
        fetchAddress();
      } else {
        toast.error("Failed to delete address");
        fetchAddress(); // Refresh to restore state if failed
      }
    } catch (error) {
      console.error("Error in handleDeleteAddress:", error);
      AxiosTostError(error);
      fetchAddress(); // Refresh to restore state on error
    }
  };

  // Function to handle editing an address
  const handleEditAddress = (address) => {
    console.log("Setting edit address data:", address);
    // Make a deep copy to prevent any reference issues
    setEditAddressData({...address});
    setOpenEditAddress(true);
  };

  const handleContinueToPayment = () => {
    // Check if there's a valid selected address
    if (selectedAddressIndex === null) {
      toast.error("Please select an address");
      return;
    }
    
    // Verify that the selected address exists in the address list
    if (!addressList || !addressList[selectedAddressIndex]) {
      toast.error("Selected address is no longer available. Please select another address.");
      setSelectedAddressIndex(null);
      return;
    }
    
    // Check if delivery charge is being calculated
    if (isCalculatingDelivery) {
      toast.error("Please wait while we calculate delivery charges");
      return;
    }
    
    // Check if delivery charge has been calculated
    if (!isDeliveryCalculated) {
      toast.error("Delivery charge calculation is pending. Please wait.");
      return;
    }
    
    // Get the selected address
    const selectedAddr = addressList[selectedAddressIndex];
    
    // CRITICAL: Verify we have the correct address
    if (!selectedAddr || !selectedAddr._id) {
      console.error('AddressPage: Selected address is invalid!', selectedAddr);
      toast.error('Invalid address. Please select again.');
      return;
    }
    
    // Create a clean copy of the address to pass (prevent any reference issues)
    const cleanAddress = {
      _id: selectedAddr._id,
      address_line: selectedAddr.address_line,
      city: selectedAddr.city,
      state: selectedAddr.state,
      pincode: selectedAddr.pincode,
      mobile: selectedAddr.mobile,
      country: selectedAddr.country,
      addIframe: selectedAddr.addIframe,
      addressType: selectedAddr.addressType,
      userId: selectedAddr.userId
    };
    
    // Debug: Log all address data being passed with full details
    console.log('AddressPage: Navigating to payment with address data:', {
      selectedAddressIndex,
      selectedAddressId: cleanAddress._id,
      selectedAddress: cleanAddress,
      deliveryCharge: deliveryCharge,
      deliveryDistance: deliveryDistance,
      estimatedDeliveryDate: estimatedDeliveryDate,
      deliveryDays: deliveryDays
    });
    
    // Verify this is not a different address by checking against all addresses
    console.log('AddressPage: All available addresses:', addressList.map(addr => ({
      _id: addr._id,
      address_line: addr.address_line,
      city: addr.city
    })));
    
    
    // Store address data in sessionStorage as backup
    const addressDataForPayment = {
      selectedAddressId: cleanAddress._id,
      selectedAddress: cleanAddress,
      deliveryCharge: deliveryCharge,
      deliveryDistance: deliveryDistance,
      estimatedDeliveryDate: estimatedDeliveryDate,
      deliveryDays: deliveryDays,
      timestamp: new Date().getTime()
    };
    
    sessionStorage.setItem('checkoutAddressData', JSON.stringify(addressDataForPayment));
    
    // Continue to payment with the selected address and calculated delivery charge
    navigate('/checkout/payment', { 
      replace: false,
      state: addressDataForPayment
    });
  };
  console.log('checkoutItems:', checkoutItems);
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
              <div className="text-3xs sm:text-xs uppercase tracking-wider md:tracking-widest font-medium text-white">ADDRESS</div>
              <div className="w-3 sm:w-8 h-px bg-gray-600"></div>
              <div className="text-3xs sm:text-xs uppercase tracking-wider md:tracking-widest font-medium text-gray-300">
                <span className="cursor-not-allowed">PAYMENT</span>
              </div>
            </div>
            <div className="w-20 sm:w-24">
              {/* Placeholder for balance */}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Address Section */}
          <div className="lg:col-span-2">
            {/* Address Selection Section */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="p-4 sm:p-5 border-b">
                <h2 className="text-base sm:text-lg font-medium tracking-tight uppercase">Select Delivery Address</h2>
              </div>
              
              <div className="p-3 sm:p-4 md:p-5">
                <div className="mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-gray-700 font-medium tracking-wide">DEFAULT ADDRESS</p>
                </div>
                
                <div className="space-y-3 sm:space-y-4">
                  {addressList.filter(address => address.status).map((address, index) => (
                    <div 
                      key={address._id}
                      className={`relative border rounded-md p-3 sm:p-4 transition-all duration-200 ${
                        selectedAddressIndex === index ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="mr-4 mt-1">
                          <input
                            id={`address-${index}`}
                            type="radio"
                            name="address"
                            value={index}
                            checked={selectedAddressIndex === index}
                            onChange={() => {
                              console.log('AddressPage: Address selected at index', index, ':', {
                                _id: address._id,
                                address_line: address.address_line,
                                city: address.city,
                                state: address.state,
                                pincode: address.pincode
                              });
                              setSelectedAddressIndex(index);
                              // Reset calculation status when new address is selected
                              setIsDeliveryCalculated(false);
                            }}
                            className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="font-medium tracking-tight text-sm sm:text-base">{address.address_line}</span>
                            {address.addressType === 'HOME' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs sm:text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                HOME
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2">
                            {address.city}, {address.state} - {address.pincode}
                          </div>
                          
                          <div className="text-xs sm:text-sm text-gray-600 mt-1">
                            Mobile: {address.mobile}
                          </div>
                          
                          <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                            <button
                              onClick={() => {
                                console.log("Edit button clicked for address:", address);
                                handleEditAddress({...address});  // Pass a deep copy of the address
                              }}
                              className="text-3xs sm:text-xs text-black font-medium border border-gray-300 rounded-md px-3 sm:px-4 py-1 sm:py-1.5 hover:bg-gray-50 transition-colors"
                            >
                              EDIT
                            </button>
                            
                            <button
                              onClick={() => handleDeleteAddress(address._id)}
                              type="button"
                              className="text-3xs sm:text-xs text-gray-700 font-medium border border-gray-300 rounded-md px-3 sm:px-4 py-1 sm:py-1.5 hover:bg-gray-100 hover:text-black transition-colors"
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {selectedAddressIndex === index && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200">
                          <p className="text-xs sm:text-sm text-gray-600">
                            • Pay on Delivery available
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Add New Address Button */}
                  <div 
                    onClick={() => setOpenAddAddress(true)}
                    className="flex items-center justify-center p-3 sm:p-4 border border-dashed border-gray-300 rounded-md cursor-pointer hover:border-black hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="text-center">
                      <div className="text-black mb-1 text-lg sm:text-xl">+</div>
                      <div className="text-xs sm:text-sm font-medium tracking-tight">Add New Address</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                        className="flex items-start border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        {/* Product Image */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
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
                        
                        {/* Product Details */}
                        <div className="ml-3 sm:ml-4 flex-1">
                          <h3 className="text-sm sm:text-base font-medium line-clamp-1 tracking-tight" title={pricing.productTitle}>
                            {pricing.productTitle}
                            {pricing.isBundle && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Bundle
                              </span>
                            )}
                          </h3>
                          
                          <div className="flex flex-wrap text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
                            <span className="mr-3">
                              Size: <span className="font-semibold">{size}</span>
                              {item.sizeAdjustedPrice && item.sizeAdjustedPrice !== item.productId?.price && (
                                <span className="ml-1 text-green-600 font-medium">
                                  (Size-specific price: {DisplayPriceInRupees(item.sizeAdjustedPrice)})
                                </span>
                              )}
                            </span>
                            <span>Qty: {pricing.quantity}</span>
                          </div>
                          
                          <div className="mt-1 sm:mt-2 flex items-center">
                            <span className="font-medium text-sm sm:text-base">
                              {DisplayPriceInRupees(pricing.totalPrice)}
                            </span>
                            {/* Only show discount for products, not bundles */}
                            {!pricing.isBundle && pricing.discount > 0 && (
                              <>
                                <span className="mx-2 text-xs sm:text-sm line-through text-gray-400">
                                  {DisplayPriceInRupees(pricing.totalOriginalPrice)}
                                </span>
                                <span className="text-xs sm:text-sm text-gray-900">
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
                          
                          {/* Delivery Date Display */}
                          {estimatedDeliveryDate && (
                            <div className="mt-1 sm:mt-2">
                              <span className="text-xs sm:text-sm text-gray-900 font-medium">
                                Delivery by {estimatedDeliveryDate}
                                {deliveryDays && (
                                  <span className="text-gray-600 ml-1">
                                    ({deliveryDays} {deliveryDays === 1 ? 'day' : 'days'})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
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
                <h2 className="text-base sm:text-lg font-medium tracking-tight uppercase">Price Details ({totalQty} {totalQty === 1 ? 'Item' : 'Items'})</h2>
              </div>
              
              <div className="p-4 sm:p-5">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Total MRP</span>
                    <span className="font-medium text-sm sm:text-base">₹{notDiscountTotalPrice.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Discount on MRP</span>
                    <span className="text-gray-900 font-medium text-sm sm:text-base">-₹{(notDiscountTotalPrice - totalPrice).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Platform Fee</span>
                    <div className="flex items-center">
                      <span className="line-through text-gray-500 mr-1 text-sm">₹99</span>
                      <span className="text-gray-900 font-medium text-sm sm:text-base">FREE</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 text-sm sm:text-base">Delivery Charge</span>
                    {isCalculatingDelivery ? (
                      <span className="text-gray-900 text-sm sm:text-base">Calculating...</span>
                    ) : !isDeliveryCalculated && selectedAddressIndex !== null ? (
                      <span className="text-gray-900 text-sm sm:text-base">Pending</span>
                    ) : (
                      <span className={`${deliveryCharge > 0 ? "text-gray-900" : "text-gray-900"} font-medium text-sm sm:text-base`}>
                        {deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE'}
                      </span>
                    )}
                  </div>
                  
                  {/* Delivery Date Information */}
                  {estimatedDeliveryDate && isDeliveryCalculated && (
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-700">Estimated Delivery</span>
                      <span className="text-gray-900 font-medium">
                        {estimatedDeliveryDate}
                        {deliveryDistance && deliveryDistance !== '0' && (
                          <div className="text-xs text-gray-500 text-right">
                            ({deliveryDistance} km • {deliveryDays} {deliveryDays === 1 ? 'day' : 'days'})
                          </div>
                        )}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between font-semibold">
                      <span className="text-base sm:text-lg tracking-tight">Total Amount</span>
                      <span className="text-base sm:text-lg">₹{(totalPrice + deliveryCharge).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleContinueToPayment}
                  disabled={selectedAddressIndex === null || isCalculatingDelivery || !isDeliveryCalculated}
                  className="w-full bg-black hover:bg-gray-800 text-white py-3 sm:py-4 mt-6 font-medium text-sm sm:text-base disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 tracking-wide uppercase"
                >
                  {isCalculatingDelivery ? "Calculating Delivery..." : "Continue to Payment"}
                </button>
                
                {/* Helper text for disabled button */}
                {selectedAddressIndex === null && (
                  <p className="text-xs text-gray-600 text-center mt-2 font-medium">
                    Please select an address to continue
                  </p>
                )}
                {selectedAddressIndex !== null && isCalculatingDelivery && (
                  <p className="text-xs text-gray-600 text-center mt-2 font-medium">
                    Calculating delivery charges...
                  </p>
                )}
                {selectedAddressIndex !== null && !isCalculatingDelivery && !isDeliveryCalculated && (
                  <p className="text-xs text-gray-600 text-center mt-2 font-medium">
                    Delivery charge calculation pending
                  </p>
                )}
                
                <div className="mt-6 text-xs sm:text-sm text-center text-gray-600 space-y-1">
                  <p className="font-medium tracking-tight">Safe and Secure Payments. Easy returns.</p>
                  <p className="tracking-tight">100% Authentic products.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recommended Products */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-8">
        <RandomCategoryProducts 
          title="Frequently Bought Together" 
          limit={6}
        />
      </div>

      {/* Modals */}
      {openAddAddress && <AddAddress close={() => setOpenAddAddress(false)} />}
      {openEditAddress && editAddressData && (
        <EditAddressData
          close={() => {
            setOpenEditAddress(false);
            setEditAddressData(null);
          }}
          data={editAddressData}
        />
      )}
    </div>
  );
};

// Wrap with ErrorBoundary for better error handling
const AddressPageWithErrorBoundary = () => (
  <ErrorBoundary>
    <AddressPage />
  </ErrorBoundary>
);

export default AddressPageWithErrorBoundary;
