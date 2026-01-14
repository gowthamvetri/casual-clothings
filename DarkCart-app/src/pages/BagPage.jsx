import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { DisplayPriceInRupees } from '../utils/DisplayPriceInRupees';
// Import PricingService instead of direct pricewithDiscount
import { PricingService } from '../utils/PricingService';
import { useGlobalContext } from '../provider/GlobalProvider';
import { FaArrowRight } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import Logo from '../assets/logo.png';
import noCart from '../assets/Empty-cuate.png';
import Axios from '../utils/Axios';
import SummaryApi from '../common/SummaryApi';
import ErrorBoundary from '../components/ErrorBoundary';
import ProductImageLink from '../components/ProductImageLink';
import RandomCategoryProducts from '../components/RandomCategoryProducts';
import { 
  toggleItemSelection, 
  selectAllItems, 
  deselectAllItems,
  setSelectedItems 
} from '../store/cartProduct';

// Helper function to safely access product properties
const getProductProperty = (item, propertyPath, fallback = "") => {
  try {
    if (!item) return fallback;
    
    const paths = [
      `product.${propertyPath}`,
      `productId.${propertyPath}`,
      `bundleId.${propertyPath}`,
      propertyPath
    ];
    
    for (const path of paths) {
      const value = path.split('.').reduce((obj, key) => {
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

// Function to calculate item pricing consistently
const calculateItemPricing = (item) => {
  let productTitle = 'Item';
  let originalPrice = 0;
  let finalPrice = 0;
  let discount = 0;
  let isBundle = false;
  let quantity = item.quantity || 1;
  
  console.log('calculateItemPricing input:', {
    itemType: item.itemType,
    hasProductId: !!item.productId,
    hasBundleId: !!item.bundleId,
    productIdPrice: item.productId?.price,
    bundleIdPrice: item.bundleId?.bundlePrice,
    directPrice: item.price,
    quantity: quantity
  });
  
  if (item.productId && item.productId._id) {
    // Regular product
    productTitle = item.productId.name || 'Product';
    
    // Check if there's a size-adjusted price first
    if (item.sizeAdjustedPrice) {
      originalPrice = Number(item.sizeAdjustedPrice) || 0;
      console.log(`Using size-adjusted price for ${item.productId.name}: ₹${originalPrice} (Size: ${item.size})`);
    } else {
      originalPrice = Number(item.productId.price) || 0;
    }
    
    discount = Number(item.productId.discount) || 0;
    // Use PricingService for consistent price calculation
    finalPrice = PricingService.applyDiscount(originalPrice, discount);
    isBundle = false;
  } else if (item.bundleId && item.bundleId._id) {
    // Bundle product
    productTitle = item.bundleId.title || item.bundleId.name || 'Bundle';
    originalPrice = Number(item.bundleId.originalPrice) || Number(item.bundleId.price) || 0;
    finalPrice = Number(item.bundleId.bundlePrice) || Number(item.bundleId.price) || originalPrice;
    discount = originalPrice > 0 ? ((originalPrice - finalPrice) / originalPrice) * 100 : 0;
    isBundle = true;
  } else if (item.itemType === 'bundle' || item.bundlePrice) {
    // Direct bundle item
    productTitle = item.title || item.name || 'Bundle';
    originalPrice = Number(item.originalPrice) || Number(item.price) || 0;
    finalPrice = Number(item.bundlePrice) || Number(item.price) || 0;
    discount = 0;
    isBundle = true;
  } else {
    // Direct product item or fallback
    productTitle = item.title || item.name || item.productId?.name || 'Product';
    originalPrice = Number(item.price) || Number(item.productId?.price) || 0;
    discount = Number(item.discount) || Number(item.productId?.discount) || 0;
    // Use PricingService for consistent price calculation
    finalPrice = PricingService.applyDiscount(originalPrice, discount);
    isBundle = false;
  }
  
  // Ensure we have valid prices
  if (originalPrice <= 0) {
    console.warn('No valid original price found for item:', item);
    originalPrice = 0;
  }
  
  if (finalPrice <= 0) {
    console.warn('No valid final price found for item:', item);
    finalPrice = originalPrice;
  }
  
  const result = {
    productTitle,
    originalPrice,
    finalPrice,
    discount,
    isBundle,
    quantity,
    totalPrice: finalPrice * quantity,
    totalOriginalPrice: originalPrice * quantity
  };
  
  console.log('calculateItemPricing result:', result);
  
  return result;
};

const BagPage = () => {
  const { fetchCartItems } = useGlobalContext();
  const cartItemsList = useSelector((state) => state.cartItem.cart);
  const selectedItems = useSelector((state) => state.cartItem.selectedItems);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Memoize selected cart items to avoid filtering on every render
  const selectedCartItems = useMemo(() => 
    cartItemsList.filter(item => selectedItems.includes(item._id)),
    [cartItemsList, selectedItems]
  );
  
  // Memoize cart totals calculation - expensive operation
  const selectedTotals = useMemo(() => {
    return selectedCartItems.reduce((totals, item) => {
      const pricing = calculateItemPricing(item);
      return {
        totalQty: totals.totalQty + pricing.quantity,
        totalPrice: totals.totalPrice + pricing.totalPrice,
        totalOriginalPrice: totals.totalOriginalPrice + pricing.totalOriginalPrice
      };
    }, { totalQty: 0, totalPrice: 0, totalOriginalPrice: 0 });
  }, [selectedCartItems]);

  // Function to check if an item is available for purchase
  const isItemAvailable = (item) => {
    if (!item) return false;
    
    // Check if it's a bundle
    if (item.itemType === 'bundle' && item.bundleId) {
      // Check if bundle exists and has an ID
      if (!item.bundleId._id) {
        return false;
      }
      
      // Check if bundle is active
      if (item.bundleId.isActive === false) {
        return false;
      }
      
      // Check bundle stock (zero stock = unavailable, insufficient stock = still available but with warning)
      if (item.bundleId.stock !== undefined && item.bundleId.stock === 0) {
        return false;
      }
      
      // Check if time-limited bundle is available
      if (item.bundleId.isTimeLimited) {
        const now = new Date();
        const startDate = new Date(item.bundleId.startDate);
        const endDate = new Date(item.bundleId.endDate);
        
        // Expired bundles are unavailable
        if (now > endDate) {
          return false;
        }
        
        // Future bundles are available but not purchasable yet
        if (now < startDate) {
          return true; // Don't auto-remove, just warn
        }
      }
      
      return true;
    }
    
    // Check if it's a product
    if (item.itemType === 'product' && item.productId) {
      // Check if product exists and has an ID
      if (!item.productId._id) {
        return false;
      }
      
      // Check if product is published (instead of isActive)
      if (item.productId.publish === false) {
        return false;
      }
      
      // Check product stock (zero stock = unavailable, insufficient stock = still available but with warning)
      if (item.productId.stock !== undefined && item.productId.stock === 0) {
        return false;
      }
      
      return true;
    }
    
    return false; // Invalid item type or missing data
  };

  // Auto-select all available items when cart loads initially
  useEffect(() => {
    if (cartItemsList.length > 0) {
      if (cartItemsList.length === 1) {
        // For single item, always select it if it's available
        const singleItem = cartItemsList[0];
        if (isItemAvailable(singleItem)) {
          dispatch(setSelectedItems([singleItem._id]));
        } else {
          dispatch(setSelectedItems([]));
        }
      } else if (selectedItems.length === 0) {
        // For multiple items, only auto-select if no items are currently selected
        const availableItems = cartItemsList
          .filter(item => isItemAvailable(item))
          .map(item => item._id);
        
        if (availableItems.length > 0) {
          dispatch(setSelectedItems(availableItems));
        }
      }
    }
  }, [cartItemsList, selectedItems.length, dispatch]);

  // Inspect the cart on component mount
  React.useEffect(() => {
    if (cartItemsList && cartItemsList.length > 0) {
      console.log("BagPage: Initial cart inspection");
      cartItemsList.forEach((item, index) => {
        console.log(`Item ${index} price check:`, {
          itemType: item.itemType,
          productId_price: item.productId?.price,
          bundleId_bundlePrice: item.bundleId?.bundlePrice,
          directPrice: item.price,
          quantity: item.quantity,
          isSelected: selectedItems.includes(item._id)
        });
      });
    }
  }, [cartItemsList, selectedItems]);
  
  // Function to validate cart items and alert user of any issues
  const validateCartItemsStatus = () => {
    if (!cartItemsList || cartItemsList.length === 0) return;
    
    let hasExpiredTimeLimitedBundles = false;
    let hasOutOfStockItems = false;
    let hasFutureStartDate = false;
    let hasInactiveItems = false;
    const itemsToRemove = [];
    
    cartItemsList.forEach(item => {
      let shouldRemove = false;
      
      // Check bundles
      if (item.bundleId && item.bundleId._id) {
        // Check if bundle is active
        if (item.bundleId.isActive === false) {
          hasInactiveItems = true;
          shouldRemove = true;
        }
        
        // Check time-limited bundles
        if (item.bundleId.isTimeLimited) {
          const now = new Date();
          const startDate = new Date(item.bundleId.startDate);
          const endDate = new Date(item.bundleId.endDate);
          
          if (now < startDate) {
            hasFutureStartDate = true;
          } else if (now > endDate) {
            hasExpiredTimeLimitedBundles = true;
            shouldRemove = true;
          }
        }
        
        // Check stock
        if (item.bundleId.stock !== undefined && item.bundleId.stock === 0) {
          hasOutOfStockItems = true;
          shouldRemove = true;
        }
      }
      
      // Check products
      if (item.productId && item.productId._id) {
        // Check if product is published (active)
        if (item.productId.publish === false) {
          hasInactiveItems = true;
          shouldRemove = true;
        }
        
        if (item.productId.stock !== undefined && item.productId.stock === 0) {
          hasOutOfStockItems = true;
          shouldRemove = true;
        }
      }
      
      if (shouldRemove) {
        itemsToRemove.push(item);
      }
    });
    
    // Auto-remove invalid items
    if (itemsToRemove.length > 0) {
      itemsToRemove.forEach(async (item) => {
        await deleteCartItem(item._id);
      });
      
      // Show notification about removed items
      setTimeout(() => {
        const removedCount = itemsToRemove.length;
        toast.success(`${removedCount} unavailable item${removedCount > 1 ? 's' : ''} automatically removed from cart`, {
          duration: 5000,
          id: "auto-removed-items"
        });
      }, 1000);
    }
    
    // Display alerts to user for remaining issues
    if (hasFutureStartDate) {
      toast("Some bundles in your cart are not yet available for purchase. Please check the start dates.", {
        duration: 6000,
        id: "future-bundles-info",
        icon: 'ℹ️'
      });
    }
  };
  
  // Validate cart items on component mount
  React.useEffect(() => {
    if (cartItemsList.length > 0) {
      validateCartItemsStatus();
    }
  }, [cartItemsList]);
  
  const updateCartItem = async (itemId, quantity) => {
    try {
      const response = await Axios({
        ...SummaryApi.updateCartItemQty,
        data: {
          _id: itemId,
          qty: quantity,
        },
      });

      const { data } = response;
      if (data.success) {
        fetchCartItems();
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("Error updating cart item:", error);
      return { success: false, error };
    }
  };

  const deleteCartItem = async (itemId) => {
    try {
      const response = await Axios({
        ...SummaryApi.deleteCartItem,
        data: {
          _id: itemId,
        },
      });

      const { data } = response;
      if (data.success) {
        fetchCartItems();
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("Error deleting cart item:", error);
      return { success: false, error };
    }
  };

  const handleQuantityChange = async (item, currentQty, change) => {
    const newQty = currentQty + change;
    const itemId = item._id;
    
    if (!itemId) {
      toast.error("Updating cart item...");
      console.log("Full cart item:", JSON.stringify(item, null, 2));
      return;
    }
    
    // Check stock limits for increment
    if (change > 0) {
      let stockLimit = null;
      if (item.bundleId && item.bundleId.stock !== undefined) {
        stockLimit = item.bundleId.stock;
      } else if (item.productId && item.productId.stock !== undefined) {
        stockLimit = item.productId.stock;
      }
      
      if (stockLimit !== null && newQty > stockLimit) {
        toast.error(`Maximum stock reached! Only ${stockLimit} available`);
        return;
      }
    }
    
    if (newQty <= 0) {
      const result = await deleteCartItem(itemId);
      if (result.success) {
        toast.success("Item removed from bag");
      } else {
        toast.error("Failed to remove item");
      }
    } else {
      const result = await updateCartItem(itemId, newQty);
      if (result.success) {
        toast.success(change > 0 ? "Quantity increased" : "Quantity decreased");
      } else {
        toast.error("Failed to update quantity");
      }
    }
  };

  // Memoize remove handler to prevent recreating on every render
  const handleRemoveItem = useCallback(async (item) => {
    const itemId = item._id;
    
    if (!itemId) {
      toast.error("Item ID not found");
      return;
    }
    
    const result = await deleteCartItem(itemId);
    if (result.success) {
      toast.success("Item removed from bag");
    } else {
      toast.error("Failed to remove item");
    }
  }, []);

  // Memoize checkout handler to prevent recreating on every render
  const handleProceedToCheckout = useCallback(async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to checkout");
      return;
    }
    
    try {
      const response = await Axios({
        ...SummaryApi.validateCartItems,
        data: {
          cartItemIds: selectedItems
        }
      });
      
      if (response.data.success) {
        sessionStorage.setItem('selectedCartItems', JSON.stringify(selectedItems));
        
        const selectedCartItemsData = cartItemsList.filter(item => 
          selectedItems.includes(item._id)
        );
        sessionStorage.setItem('selectedCartItemsData', JSON.stringify(selectedCartItemsData));
        
        navigate('/checkout/address');
      } else {
        toast.error(response.data.message || "Some items in your cart are unavailable for purchase");
        fetchCartItems();
      }
    } catch (error) {
      console.error("Error validating cart items:", error);
      
      // Handle token expiration specifically
      if (error.response?.status === 401 && error.response?.data?.tokenExpired) {
        toast.error("Your session has expired. Please login again.");
        // Clear tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        // Redirect to login
        navigate('/login');
        return;
      }
      
      // Extract and display the error message from the response if available
      const errorMessage = error.response?.data?.message || 
        "Failed to validate cart items. Please try again.";
      
      toast.error(errorMessage);
      
      // Refresh cart items to ensure we have the latest data
      fetchCartItems();
      
      // If there are specific items that caused the error, log them and show more details
      if (error.response?.data?.invalidItems) {
        console.log("Invalid items:", error.response.data.invalidItems);
        
        // Show specific error messages for invalid items
        const invalidItems = error.response.data.invalidItems;
        invalidItems.forEach((invalidItem, index) => {
          setTimeout(() => {
            const itemName = invalidItem.productName || invalidItem.bundleTitle || 'Unknown item';
            toast.error(`${itemName}: ${invalidItem.reason}`, {
              duration: 5000,
              id: `invalid-item-${index}`
            });
          }, (index + 1) * 1000); // Stagger the error messages
        });
        
        // Automatically deselect invalid items
        const invalidCartItemIds = invalidItems.map(item => item.cartItemId);
        const validSelectedItems = selectedItems.filter(id => !invalidCartItemIds.includes(id));
        if (validSelectedItems.length !== selectedItems.length) {
          dispatch(setSelectedItems(validSelectedItems));
          setTimeout(() => {
            toast(`${invalidCartItemIds.length} invalid item(s) have been deselected.`, {
              duration: 4000,
              icon: 'ℹ️'
            });
          }, invalidItems.length * 1000 + 500);
        }
      }
      
      // Refresh cart to update availability
      fetchCartItems();
    }
  }, [selectedItems, cartItemsList, navigate, fetchCartItems, dispatch]);

  const handleSelectAll = () => {
    if (selectedItems.length === cartItemsList.length) {
      dispatch(deselectAllItems());
    } else {
      // Only select available items
      const availableItems = cartItemsList
        .filter(item => isItemAvailable(item))
        .map(item => item._id);
      
      dispatch(setSelectedItems(availableItems));
      
      if (availableItems.length < cartItemsList.length) {
        toast(`${cartItemsList.length - availableItems.length} item(s) cannot be selected because they are unavailable for purchase.`, {
          icon: 'ℹ️',
          duration: 4000
        });
      }
    }
  };

  const handleItemSelection = (itemId) => {
    const item = cartItemsList.find(item => item._id === itemId);
    
    // If item is not available, don't allow selection
    if (item && !isItemAvailable(item)) {
      toast.error("This item is not available for purchase.");
      return;
    }
    
    dispatch(toggleItemSelection(itemId));
  };

  const moveToWishlist = (item) => {
    const itemId = item._id;
    
    if (!itemId) {
      toast.error("Item ID not found");
      console.error("Item ID not found in:", item);
      return;
    }
    
    toast.success("Item moved to wishlist");
    // Implement actual wishlist functionality here
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
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="text-2xs sm:text-xs uppercase tracking-widest font-medium text-white">BAG</div>
              <div className="w-4 sm:w-8 h-px bg-gray-600"></div>
              <div className="text-2xs sm:text-xs uppercase tracking-widest font-medium text-gray-300">
                <span className="cursor-pointer hover:text-white transition-colors">ADDRESS</span>
              </div>
              <div className="w-4 sm:w-8 h-px bg-gray-600"></div>
              <div className="text-2xs sm:text-xs uppercase tracking-widest font-medium text-gray-300">
                <span className="cursor-not-allowed">PAYMENT</span>
              </div>
            </div>
            <div className="w-20 sm:w-24">
              {/* Placeholder to balance the layout */}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {cartItemsList.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 text-center">
            <div className="text-lg sm:text-xl font-medium tracking-tight mb-4">Your bag is empty</div>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">Looks like you haven't added anything to your bag yet.</p>
            <Link to="/" className="inline-block bg-black text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-md hover:bg-gray-800 transition-colors text-sm sm:text-base font-medium tracking-wide">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Bag Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded shadow mb-6">
                <div className="p-4 border-b">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium">
                      {cartItemsList.length} {cartItemsList.length === 1 ? 'ITEM' : 'ITEMS'} IN BAG
                    </h2>
                    {cartItemsList.length > 1 && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="selectAll"
                          checked={selectedItems.length === cartItemsList.length && cartItemsList.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
                        />
                        <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                          Select All ({selectedItems.length}/{cartItemsList.length})
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 sm:p-5">
                  {/* Debug button to check cart structure */}
                  {import.meta.env.DEV && (
                    <button 
                      onClick={() => {
                        console.log("Cart items structure:", cartItemsList);
                        console.log("Selected items:", selectedItems);
                        console.log("Selected totals:", selectedTotals);
                        if (cartItemsList && cartItemsList.length > 0) {
                          console.log("First item structure:", JSON.stringify(cartItemsList[0], null, 2));
                          
                          const item = cartItemsList[0];
                          console.log("Price extraction paths:");
                          console.log("- item.productId?.price:", item.productId?.price);
                          console.log("- item.bundleId?.bundlePrice:", item.bundleId?.bundlePrice);
                          console.log("- item.product?.price:", item.product?.price);
                          console.log("- item.price:", item.price);
                          
                          console.log("calculateItemPricing result:", calculateItemPricing(item));
                        }
                        toast.success("Cart structure logged to console for debugging");
                      }}
                      className="mb-4 text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-md"
                    >
                      Debug Cart Structure
                    </button>
                  )}
                  
                  {cartItemsList.map((item, index) => {
                    const itemId = getProductProperty(item, '_id', `item-${index}`);
                    const pricing = calculateItemPricing(item);
                    const isSelected = selectedItems.includes(item._id);
                    
                    // If we still don't have a valid price, show an error state
                    const isPriceUnavailable = pricing.finalPrice <= 0 && pricing.originalPrice <= 0;
                    
                    if (isPriceUnavailable) {
                      console.error('Product price unavailable for item:', item);
                    }
                    
                    // Get image source safely
                    let imageSrc = noCart;
                    if (item.productId && item.productId._id) {
                      imageSrc = item.productId.image?.[0] || item.productId.primaryImage || noCart;
                    } else if (item.bundleId && item.bundleId._id) {
                      imageSrc = item.bundleId.images?.[0] || item.bundleId.image || noCart;
                    } else {
                      imageSrc = item.image?.[0] || item.images?.[0] || item.primaryImage || item.image || noCart;
                    }
                    
                    const size = getProductProperty(item, 'size', 'Standard');
                    const brand = getProductProperty(item, 'brand', '');
                    
                    return (
                      <div key={`bag-item-${itemId}-${index}`} className={`flex border-b last:border-b-0 py-5 ${isSelected ? 'bg-gray-50' : ''} ${!isItemAvailable(item) ? 'opacity-75' : ''}`}>
                        <div className="flex flex-col sm:flex-row items-start w-full">
                          {/* Checkbox and Product Image */}
                          <div className="flex items-start">
                            {cartItemsList.length > 1 && (
                              <div className="mr-3 relative">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => handleItemSelection(item._id)}
                                  disabled={!isItemAvailable(item)}
                                  className={`h-5 w-5 border-gray-300 rounded ${isItemAvailable(item) ? 'text-black focus:ring-black' : 'text-gray-300 cursor-not-allowed'}`}
                                />
                                {!isItemAvailable(item) && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                                )}
                              </div>
                            )}
                            <div className="w-20 h-24 sm:w-24 sm:h-28 flex-shrink-0">
                              {item.productId?._id ? (
                                <ProductImageLink 
                                  imageUrl={imageSrc}
                                  productId={item.productId._id}
                                  alt={pricing.productTitle}
                                  className="w-full h-full rounded"
                                  imageClassName="rounded"
                                  height="100%"
                                  width="100%"
                                />
                              ) : item.bundleId?._id ? (
                                <ProductImageLink 
                                  imageUrl={imageSrc}
                                  productId={item.bundleId._id}
                                  alt={pricing.productTitle}
                                  className="w-full h-full rounded"
                                  imageClassName="rounded"
                                  height="100%"
                                  width="100%"
                                  disableNavigation={true} // Disable for bundles, or create a separate handler
                                />
                              ) : (
                                <img 
                                  src={imageSrc} 
                                  alt={pricing.productTitle}
                                  className="w-full h-full object-cover rounded"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = noCart;
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          
                          {/* Product Details */}
                          <div className="ml-4 sm:ml-8 flex-1 mt-4 sm:mt-0">
                            {brand && (
                              <div className="text-gray-600 font-medium text-sm">{brand}</div>
                            )}
                            <h3 className="font-medium text-md sm:text-lg">
                              {pricing.productTitle}
                              {pricing.isBundle && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                                  Bundle
                                </span>
                              )}
                              {!pricing.isBundle && item.size && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Size: {item.size}
                                </span>
                              )}
                            </h3>
                            
                            {/* Time-limited bundle warning */}
                            {item.bundleId && item.bundleId.isTimeLimited && (
                              <div className="mt-1">
                                {(() => {
                                  const now = new Date();
                                  const startDate = new Date(item.bundleId.startDate);
                                  const endDate = new Date(item.bundleId.endDate);
                                  
                                  if (now < startDate) {
                                    return (
                                      <div className="text-xs font-medium text-blue-600 flex items-center">
                                        <span className="inline-block w-2 h-2 rounded-full bg-blue-600 mr-1"></span>
                                        Offer starts on {startDate.toLocaleDateString()}
                                      </div>
                                    );
                                  } else if (now > endDate) {
                                    return (
                                      <div className="text-xs font-medium text-red-600 flex items-center">
                                        <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"></span>
                                        Offer expired on {endDate.toLocaleDateString()}
                                      </div>
                                    );
                                  } else {
                                    // Calculate days remaining
                                    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                                    return (
                                      <div className="text-xs font-medium text-orange-600 flex items-center">
                                        <span className="inline-block w-2 h-2 rounded-full bg-orange-600 mr-1"></span>
                                        Limited offer ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            
                            {/* Inactive product/bundle warning */}
                            {((item.bundleId && item.bundleId.isActive === false) || (item.productId && item.productId.publish === false)) && (
                              <div className="text-xs font-medium text-red-600 flex items-center mt-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"></span>
                                Item is no longer available
                              </div>
                            )}
                            
                            {/* Stock warning for bundles */}
                            {item.bundleId && item.bundleId.stock !== undefined && item.bundleId.stock < 10 && item.bundleId.stock > 0 && (
                              <div className="text-xs font-medium text-orange-600 flex items-center mt-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-orange-600 mr-1"></span>
                                Only {item.bundleId.stock} left in stock!
                              </div>
                            )}
                            
                            {/* Insufficient stock warning */}
                            {((item.bundleId && item.bundleId.stock !== undefined && item.bundleId.stock < item.quantity) || 
                              (item.productId && item.productId.stock !== undefined && item.productId.stock < item.quantity)) && (
                              <div className="text-xs font-medium text-red-600 flex items-center mt-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"></span>
                                Insufficient stock (Available: {item.bundleId?.stock || item.productId?.stock || 0}, Requested: {item.quantity})
                              </div>
                            )}
                            
                            {/* Out of stock warning */}
                            {((item.bundleId && item.bundleId.stock === 0) || (item.productId && item.productId.stock === 0)) && (
                              <div className="text-xs font-medium text-red-600 flex items-center mt-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"></span>
                                Out of stock
                              </div>
                            )}
                            
                            <div className="text-sm text-gray-600 mt-1">
                              Size: {size}
                              {item.sizeAdjustedPrice && (
                                <span className="text-green-600 ml-2">
                                  (Price adjusted for size)
                                </span>
                              )}
                            </div>
                            
                            {/* Price Display */}
                            <div className="flex items-center mt-3">
                              <div className="text-md">
                                <span className="font-semibold text-lg text-gray-900">
                                  {pricing.finalPrice > 0 ? DisplayPriceInRupees(pricing.totalPrice) : "Price unavailable"}
                                </span>
                                {pricing.originalPrice > pricing.finalPrice && pricing.originalPrice > 0 && (
                                  <span className="text-sm text-gray-500 line-through ml-2">
                                    {DisplayPriceInRupees(pricing.totalOriginalPrice)}
                                  </span>
                                )}
                                {pricing.quantity > 1 && (
                                  <span className="text-xs text-gray-600 ml-1 block">
                                    ({DisplayPriceInRupees(pricing.finalPrice)} each)
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 space-y-3 sm:space-y-0">
                              <div className="flex items-center border border-gray-300 rounded-md">
                                <button 
                                  onClick={() => handleQuantityChange(item, pricing.quantity, -1)}
                                  className="px-3 py-1 text-lg font-medium hover:bg-gray-100 text-gray-800"
                                >
                                  -
                                </button>
                                <div className="px-3 py-1 text-sm font-medium text-gray-800">
                                  {pricing.quantity}
                                </div>
                                <button 
                                  onClick={() => handleQuantityChange(item, pricing.quantity, 1)}
                                  disabled={(() => {
                                    // Check if increment should be disabled due to stock limit
                                    let stockLimit = null;
                                    if (item.bundleId && item.bundleId.stock !== undefined) {
                                      stockLimit = item.bundleId.stock;
                                    } else if (item.productId && item.productId.stock !== undefined) {
                                      stockLimit = item.productId.stock;
                                    }
                                    return stockLimit !== null && pricing.quantity >= stockLimit;
                                  })()}
                                  className={`px-3 py-1 text-lg font-medium transition-colors ${
                                    (() => {
                                      let stockLimit = null;
                                      if (item.bundleId && item.bundleId.stock !== undefined) {
                                        stockLimit = item.bundleId.stock;
                                      } else if (item.productId && item.productId.stock !== undefined) {
                                        stockLimit = item.productId.stock;
                                      }
                                      return stockLimit !== null && pricing.quantity >= stockLimit
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'hover:bg-gray-100 text-gray-800';
                                    })()
                                  }`}
                                >
                                  +
                                </button>
                              </div>
                              
                              <div className="flex space-x-4">
                                <button 
                                  onClick={() => moveToWishlist(item)}
                                  className="text-xs sm:text-sm text-gray-800 hover:text-gray-600 font-medium"
                                >
                                  MOVE TO WISHLIST
                                </button>
                                <button 
                                  onClick={() => handleRemoveItem(item)}
                                  className="text-xs sm:text-sm text-gray-800 hover:text-gray-600 font-medium"
                                >
                                  REMOVE
                                </button>
                              </div>
                            </div>
                            
                            {/* Maximum stock reached message */}
                            {(() => {
                              let stockLimit = null;
                              if (item.bundleId && item.bundleId.stock !== undefined) {
                                stockLimit = item.bundleId.stock;
                              } else if (item.productId && item.productId.stock !== undefined) {
                                stockLimit = item.productId.stock;
                              }
                              return stockLimit !== null && pricing.quantity >= stockLimit && (
                                <p className="text-xs text-amber-600 text-center mt-2">Maximum stock reached</p>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Right Column - Price Details (Only for selected items) */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded shadow sticky top-4">
                <div className="p-4 sm:p-5 border-b">
                  <h2 className="text-lg font-medium text-gray-900">
                    {cartItemsList.length === 1 
                      ? `PRICE DETAILS (${selectedTotals.totalQty} ${selectedTotals.totalQty === 1 ? 'Item' : 'Items'})`
                      : `PRICE DETAILS (${selectedTotals.totalQty} ${selectedTotals.totalQty === 1 ? 'Item' : 'Items'} Selected)`
                    }
                  </h2>
                </div>
                
                <div className="p-4 sm:p-5">
                  {selectedItems.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">No items selected for checkout</p>
                      <p className="text-sm text-gray-500">Select items from your bag to see price details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-800">Total MRP</span>
                        <span className="text-gray-900">₹{selectedTotals.totalOriginalPrice.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-800">Discount on MRP</span>
                        <span className="text-gray-900">-₹{(selectedTotals.totalOriginalPrice - selectedTotals.totalPrice).toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-800">Platform Fee</span>
                        <div className="flex items-center">
                          <span className="line-through text-gray-500 mr-1">₹99</span>
                          <span className="text-gray-900">FREE</span>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-900">Total Amount</span>
                          <span className="text-gray-900">₹{selectedTotals.totalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={selectedItems.length === 0}
                    className="w-full bg-black hover:bg-gray-900 text-white py-3.5 mt-6 font-medium flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <span>
                      {cartItemsList.length === 1 
                        ? "PLACE ORDER" 
                        : `PLACE ORDER (${selectedItems.length})`
                      }
                    </span>
                    <FaArrowRight className="ml-2" />
                  </button>
                  
                  <div className="mt-6 text-xs text-center text-gray-600">
                    <p>Safe and Secure Payments. Easy returns.</p>
                    <p>100% Authentic products.</p>
                    {selectedItems.length > 0 && cartItemsList.length > 1 && (
                      <p className="mt-2 text-sm font-medium text-gray-800">
                        {cartItemsList.length - selectedItems.length} items will remain in your bag
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Add RandomCategoryProducts component for product suggestions */}
        {cartItemsList.length > 0 && (
          <RandomCategoryProducts 
            title="Complete Your Look" 
            limit={6}
          />
        )}
      </div>
    </div>
  );
};

// Wrap with ErrorBoundary for better error handling
const BagPageWithErrorBoundary = () => (
  <ErrorBoundary>
    <BagPage />
  </ErrorBoundary>
);

export default BagPageWithErrorBoundary;
