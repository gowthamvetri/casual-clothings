import React, { useEffect, useState, useCallback, useMemo } from "react";
import CardLoading from "../components/CardLoading";
import SummaryApi from "../common/SummaryApi";
import Axios from "../utils/Axios";
import AxiosToastError from "../utils/AxiosTostError";
import CardProduct from "../components/CardProduct";
import ProductFilter from "../components/ProductFilter";
import InfiniteScroll from "react-infinite-scroll-component";
import { useLocation, useSearchParams } from "react-router-dom";
import emptyImg from "../assets/productDescriptionImages/Empty-pana.png";
import { FaFilter, FaTimes, FaSearch } from "react-icons/fa";

function SearchPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPage, setTotalPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadingArrayCard = new Array(10).fill(null);
  const location = useLocation();
  
  // Track initial gender state to determine if gender filter should be shown
  const [initialGender, setInitialGender] = useState(null);
  const [showGenderFilter, setShowGenderFilter] = useState(true);
  
  // Extract search text properly from different URL formats
  const getSearchText = () => {
    // Check for ?q= parameter first
    const qParam = searchParams.get('q');
    if (qParam) return qParam;
    
    // Check for /search/text format
    const pathname = location.pathname;
    if (pathname.startsWith('/search/')) {
      return decodeURIComponent(pathname.slice(8)); // Remove '/search/'
    }
    
    // Check for legacy ?search= parameter
    const searchParam = searchParams.get('search');
    if (searchParam) return searchParam;
    
    // Check location.search property (if it exists in your app)
    if (location.search && location.search.startsWith('?q=')) {
      return decodeURIComponent(location.search.slice(3)); // Remove '?q='
    }
    
    return "";
  };

  const searchText = getSearchText();

  // Filter states synchronized with URL parameters
  const [filters, setFilters] = useState({
    gender: searchParams.get('gender') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || ''
  });

  // Set initial gender state on component mount and determine if gender filter should be shown
  useEffect(() => {
    const initialGenderValue = searchParams.get('gender') || '';
    setInitialGender(initialGenderValue);
    
    // If there's an initial gender selected (coming from fashion category), hide the gender filter
    // If no initial gender, show the gender filter
    setShowGenderFilter(!initialGenderValue);
  }, []); // Only run on mount

  // Handle filter changes with useCallback for performance
  const handleFilterChange = useCallback((filterType, value, secondValue = null) => {
    if (filterType === 'clear') {
      const newFilters = {
        gender: initialGender,
        minPrice: '',
        maxPrice: ''
      };
      setFilters(newFilters);
      
      const newParams = new URLSearchParams();
      if (searchText) {
        newParams.set('q', searchText);
      }
      if (initialGender) {
        newParams.set('gender', initialGender);
      }
      setSearchParams(newParams);
      return;
    }

    if (filterType === 'priceRange') {
      const newFilters = { 
        ...filters, 
        minPrice: value, 
        maxPrice: secondValue 
      };
      setFilters(newFilters);
      setPage(1);
      setData([]);
      
      const newParams = new URLSearchParams();
      if (searchText) {
        newParams.set('q', searchText);
      }
      
      Object.entries(newFilters).forEach(([key, val]) => {
        if (val && val.toString().trim() !== '') {
          newParams.set(key, val);
        }
      });
      
      setSearchParams(newParams);
      return;
    }

    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    setPage(1);
    setData([]);
    
    const newParams = new URLSearchParams();
    if (searchText) {
      newParams.set('q', searchText);
    }
    
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val && val.toString().trim() !== '') {
        newParams.set(key, val);
      }
    });
    
    setSearchParams(newParams);
  }, [filters, searchText, initialGender, setSearchParams]);

  // Memoize filter function to prevent recalculation
  const filterProducts = useCallback((products) => {
    if (!filters.minPrice && !filters.maxPrice) return products;
    
    return products.filter(product => {
      const discountedPrice = product.discount > 0 
        ? product.price - (product.price * product.discount / 100)
        : product.price;
      
      if (filters.minPrice && discountedPrice < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && discountedPrice > parseFloat(filters.maxPrice)) return false;
      
      return true;
    });
  }, [filters.minPrice, filters.maxPrice]);

  // Memoize sort function
  const sortProducts = useCallback((products, searchQuery) => {
    if (!searchQuery || searchQuery.length !== 1) return products;
    
    return [...products].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const queryChar = searchQuery.toLowerCase();
      
      const aHasChar = aName.includes(queryChar);
      const bHasChar = bName.includes(queryChar);
      
      if (aHasChar && !bHasChar) return -1;
      if (!aHasChar && bHasChar) return 1;
      
      const aStartsWith = aName.startsWith(queryChar);
      const bStartsWith = bName.startsWith(queryChar);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return aName.localeCompare(bName);
    });
  }, []);

  const fetchData = useCallback(
    async (pageNumber = 1, resetData = false) => {
      try {
        setLoading(true);

        // Build request data with search and filters
        const requestData = {
          search: searchText,
          page: pageNumber,
          limit: searchText.length === 1 ? 20 : 12,
        };

        // Add filters to request
        if (filters.gender && filters.gender.trim() !== '') {
          requestData.gender = filters.gender;
        }

        const response = await Axios({
          ...SummaryApi.searchProduct,
          data: requestData,
        });

        const { data: responseData } = response;

        if (responseData.success) {
          setTotalPage(responseData.totalNoPage);

          let processedData = responseData.data || [];

          // Apply frontend price filters using memoized function
          processedData = filterProducts(processedData);

          // Sort results for single character searches using memoized function
          processedData = sortProducts(processedData, searchText);

          if (pageNumber === 1 || resetData) {
            setData(processedData);
          } else {
            setData((prevData) => [...prevData, ...processedData]);
          }

          setHasMore(pageNumber < responseData.totalNoPage);
        }
      } catch (error) {
        AxiosToastError(error);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [searchText, filters, filterProducts, sortProducts]
  );

  const handleMoreData = useCallback(() => {
    if (hasMore && page < totalPage && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage, false);
    }
  }, [hasMore, page, totalPage, loading, fetchData]);

  // Handle search text changes or filter changes
  useEffect(() => {
    console.log('Search text or filters changed:', { searchText, filters });
    setPage(1);
    setData([]);
    setHasMore(true);
    fetchData(1, true);
  }, [fetchData]);

  // Sync URL params with filter state (except initial load)
  useEffect(() => {
    if (initialGender !== null) { // Only sync after initial load
      const newFilters = {
        gender: searchParams.get('gender') || '',
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || ''
      };
      setFilters(newFilters);
    }
  }, [searchParams, initialGender]);

  // Calculate active filters count (exclude initial gender from count)
  const getActiveFiltersCount = () => {
    let count = 0;
    
    // Only count gender if it's different from initial gender or if there was no initial gender
    if (filters.gender && (!initialGender || filters.gender !== initialGender)) {
      count++;
    }
    
    // Count price filters
    if (filters.minPrice && filters.minPrice.trim() !== '') count++;
    if (filters.maxPrice && filters.maxPrice.trim() !== '') count++;
    
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <section className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-8 lg:px-16 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {searchText ? "Search Results" : "All Products"}
                {initialGender && (
                  <span className="ml-2 text-lg font-medium text-gray-600">
                    for {initialGender}
                  </span>
                )}
              </h1>
              
              {searchText && (
                <p className="text-gray-600 mb-2">
                  Showing results for:{" "}
                  <span className="font-semibold bg-yellow-100 px-2 py-1 rounded-md">"{searchText}"</span>
                  {initialGender && (
                    <span className="font-semibold theme-bg-secondary-light theme-text-primary px-2 py-1 rounded-md ml-2">
                      in {initialGender} category
                    </span>
                  )}
                  
                  {searchText.length === 1 && (
                    <span className="text-gray-500 text-xs ml-2 theme-bg-gray px-2 py-1 rounded-md">
                      Single character search
                    </span>
                  )}
                </p>
              )}
              
              <p className="font-semibold text-gray-700 flex items-center gap-2">
                <FaSearch className="w-4 h-4" />
                Found: {data.length} results
                {totalPage > 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    (Page {page} of {totalPage})
                  </span>
                )}
              </p>
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors relative lg:hidden"
            >
              <FaFilter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Active Filters:</h3>
                <button
                  onClick={() => handleFilterChange('clear')}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Clear Filters
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Only show gender badge if it's different from initial or there was no initial gender */}
                {filters.gender && (!initialGender || filters.gender !== initialGender) && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium theme-bg-secondary-light theme-text-primary border theme-border">
                    Gender: {filters.gender}
                    <button
                      onClick={() => handleFilterChange('gender', initialGender || '')}
                      className="ml-2 theme-text-primary hover:theme-text-secondary"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(filters.minPrice || filters.maxPrice) && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                    Price: ₹{filters.minPrice || '0'} - ₹{filters.maxPrice || '∞'}
                    <button
                      onClick={() => {
                        handleFilterChange('minPrice', '');
                        handleFilterChange('maxPrice', '');
                      }}
                      className="ml-2 text-yellow-600 hover:text-yellow-800"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Pre-applied Gender Filter Display */}
          {/* {initialGender && (
            <div className="mt-4 p-3 theme-bg-gray rounded-lg border theme-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium theme-text-primary">
                    📂 Fashion Category: {initialGender}
                  </span>
                </div>
                <button
                  onClick={() => {
                    // Remove gender filter and navigate to search without gender
                    const newParams = new URLSearchParams();
                    if (searchText) {
                      newParams.set('q', searchText);
                    }
                    // Keep other filters
                    if (filters.minPrice) newParams.set('minPrice', filters.minPrice);
                    if (filters.maxPrice) newParams.set('maxPrice', filters.maxPrice);
                    
                    setSearchParams(newParams);
                    setInitialGender('');
                    setShowGenderFilter(true);
                  }}
                  className="text-xs theme-text-primary hover:theme-text-secondary font-medium underline"
                >
                  View All Categories
                </button>
              </div>
            </div>
          )} */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-6">
              {/* Mobile Close Button */}
              <div className="lg:hidden flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900 text-lg">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              
              {/* ProductFilter Component with conditional gender filter */}
              <ProductFilter 
                filters={filters} 
                onFilterChange={handleFilterChange}
                showGenderFilter={showGenderFilter}
                initialGender={initialGender}
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {/* Products Display */}
            <InfiniteScroll
              dataLength={data.length}
              hasMore={hasMore}
              next={handleMoreData}
              loader={
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
                  {loadingArrayCard.slice(0, 4).map((_, index) => (
                    <CardLoading key={"loadingMore" + index} />
                  ))}
                </div>
              }
              endMessage={
                data.length > 0 && (
                  <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
                    <p className="text-gray-500 font-medium">
                      {searchText
                        ? `You've seen all results for "${searchText}"${initialGender ? ` in ${initialGender} category` : ''}`
                        : `You've seen all products${initialGender ? ` in ${initialGender} category` : ''}`}
                    </p>
                  </div>
                )
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.map((item, index) => (
                  <CardProduct
                    data={item}
                    key={item?._id + "searchProduct" + index}
                  />
                ))}
              </div>
            </InfiniteScroll>

            {/* Initial Loading */}
            {loading && page === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {loadingArrayCard.map((_, index) => (
                  <CardLoading key={"loadingInitial" + index} />
                ))}
              </div>
            )}

            {/* No Results */}
            {!data.length && !loading && (
              <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
                <img
                  src={emptyImg}
                  alt="No results found"
                  className="w-64 h-64 object-contain mb-6"
                />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchText ? "No results found" : "No products available"}
                </h3>
                <p className="text-gray-600 text-center max-w-md mb-6">
                  {searchText ? (
                    <>
                      We couldn't find any products matching "{searchText}"
                      {initialGender && ` in ${initialGender} category`}.
                      <br />
                      Try different keywords or adjust your filters.
                    </>
                  ) : (
                    `There are currently no products available${initialGender ? ` in ${initialGender} category` : ''}.`
                  )}
                </p>
                
                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={() => handleFilterChange('clear')}
                      className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                  {initialGender && (
                    <button
                      onClick={() => {
                        const newParams = new URLSearchParams();
                        if (searchText) newParams.set('q', searchText);
                        setSearchParams(newParams);
                        setInitialGender('');
                        setShowGenderFilter(true);
                      }}
                      className="px-6 py-3 theme-bg-primary text-white rounded-lg hover:theme-bg-secondary transition-colors"
                    >
                      View All Categories
                    </button>
                  )}
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Browse All Products
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SearchPage;
