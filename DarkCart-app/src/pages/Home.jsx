import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { validURLConvert } from "../utils/validURLConvert";
import PremiumCategoryWiseProductDisplay from "../components/PremiumCategoryWiseProductDisplay";
import CartCategoryProducts from "../components/CartCategoryProducts";
import { motion } from "framer-motion";
import { FaTshirt, FaArrowRight } from "react-icons/fa";
import HomeBanner from "../components/HomeBanner";

function Home() {
  const loadingCategory = useSelector((state) => state.product.loadingCategory);
  const categoryData = useSelector((state) => state.product.allCategory);
  const navigate = useNavigate();

  // Enhance user experience with smooth scroll
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRedirectProductListPage = (id, category) => {
    const url = `category/${validURLConvert(category)}-${id}`;
    navigate(url);
  };

  return (
    <section className="min-h-screen ">
      {/* Features Section - Premium Light Theme */}

        <HomeBanner />
  

      {/* Collection Showcase - Premium Grid Layout */}
      <div className="container mx-auto pt-8 pb-6 px-4 md:px-8">
        <div className="text-center mb-8">
          <h2 className="text-xs md:text-sm uppercase tracking-[0.18em] text-gray-500 mb-2 font-sans">COLLECTIONS</h2>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 md:mb-3 font-sans">Shop By Category</h1>
          <div className="w-20 h-1 bg-gradient-to-r from-black via-gray-400 to-black mx-auto mb-4 rounded-full"></div>
          <p className="max-w-xl mx-auto text-gray-500 text-base font-light px-4 font-sans">
            Browse our carefully selected categories for your wardrobe essentials
          </p>
        </div>

        {/* Category Section - Premium Grid with horizontal scroll on mobile */}
        <div className="md:grid md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 md:gap-10 px-1 sm:px-2 md:px-8 flex md:flex-none overflow-x-auto md:overflow-visible space-x-4 md:space-x-0 pb-2 md:pb-0 scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          {/* Hide scrollbar for Webkit browsers */}
          <style>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
          `}</style>
          {loadingCategory
            ? new Array(12).fill(null).map((c, index) => {
                return (
                  <div
                    key={index + "loadingcategory"}
                    className="bg-white border border-gray-100 p-4 sm:p-5 h-32 sm:h-36 md:h-44 grid gap-3 shadow-sm rounded-lg overflow-hidden min-w-[220px] md:min-w-0 flex-shrink-0 animate-pulse"
                  >
                    <div className="bg-gray-200 h-4/5 rounded"></div>
                    <div className="bg-gray-200 h-5 rounded w-3/4 mx-auto"></div>
                  </div>
                );
              })
            : categoryData.map((category) => {
                return (
                  <div
                    key={category._id + "displayCategory"}
                    className="w-full bg-white border border-gray-200 overflow-hidden cursor-pointer shadow-sm transition-all duration-200 group min-w-[220px] md:min-w-0 flex-shrink-0"
                    onClick={() =>
                      handleRedirectProductListPage(category._id, category.name)
                    }
                  >
                    <div className="p-4 sm:p-5 h-24 sm:h-28 md:h-32 lg:h-36 flex items-center justify-center bg-white">
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-3/4 sm:w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div className="p-2 sm:p-3 border-t border-gray-200 bg-white">
                      <h3 className="text-xs sm:text-sm md:text-base font-semibold text-gray-800 text-center truncate font-sans">
                        {category.name}
                      </h3>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Custom T-Shirt Request CTA Section */}
     

      {/* Display category products with Flipkart-style spacing */}
      <div className="py-3 md:py-4">
        {categoryData?.map((c, index) => {
          return (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              key={c._id + "CategorywiseProductDisplay"}
              className={`mb-4 md:mb-6 last:mb-0 ${index > 0 ? 'pt-2 md:pt-3' : ''} bg-white shadow-sm rounded-sm mx-3 md:mx-6`}
            >
              <PremiumCategoryWiseProductDisplay
                id={c._id}
                name={c.name}
              />
              
            </motion.div>
            
          );
        })}
      </div>

      {/* Cart Categories Recommendation */}
      {/* <div className="bg-gray-50 py-4">
        <CartCategoryProducts title="You might also like" limit={8} />
      </div> */}
      
       <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className=" rounded-sm p-6 md:p-8 text-center relative overflow-hidden "
        >
          {/* Background pattern overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMxLjIgMCAyLjMuNSAzLjIgMS4zLjkuOSAxLjMgMS45IDEuMyAzLjJzLS41IDIuMy0xLjMgMy4yYy0uOS45LTIgMS4zLTMuMiAxLjNzLTIuMy0uNS0zLjItMS4zYy0uOS0uOS0xLjMtMS45LTEuMy0zLjJzLjUtMi4zIDEuMy0zLjJjLjktLjkgMi0xLjMgMy4yLTEuM3ptLTEyIDBjMS4yIDAgMi4zLjUgMy4yIDEuMy45LjkgMS4zIDEuOSAxLjMgMy4ycy0uNSAyLjMtMS4zIDMuMmMtLjkuOS0yIDEuMy0zLjIgMS4zcy0yLjMtLjUtMy4yLTEuM2MtLjktLjktMS4zLTEuOS0xLjMtMy4ycy41LTIuMyAxLjMtMy4yYy45LS45IDItMS4zIDMuMi0xLjN6bTEyIDEyYzEuMiAwIDIuMy41IDMuMiAxLjMuOS45IDEuMyAxLjkgMS4zIDMuMnMtLjUgMi4zLTEuMyAzLjJjLS45LjktMiAxLjMtMy4yIDEuM3MtMi4zLS41LTMuMi0xLjNjLS45LS45LTEuMy0xLjktMS4zLTMuMnMuNS0yLjMgMS4zLTMuMmMuOS0uOSAyLTEuMyAzLjItMS4zem0tMTIgMGMxLjIgMCAyLjMuNSAzLjIgMS4zLjkuOSAxLjMgMS45IDEuMyAzLjJzLS41IDIuMy0xLjMgMy4yYy0uOS45LTIgMS4zLTMuMiAxLjNzLTIuMy0uNS0zLjItMS4zYy0uOS0uOS0xLjMtMS45LTEuMy0zLjJzLjUtMi4zIDEuMy0zLjJjLjktLjkgMi0xLjMgMy4yLTEuM3oiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-20"></div>
          
          <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3 text-gray relative z-10">
            Want Something Unique?
          </h2>
          
          <p className="text-gray-300 mb-6 md:mb-8 max-w-2xl mx-auto relative z-10">
            Create your own custom t-shirt design with our design studio
          </p>
          
          <Link
            to="/custom-tshirt"
            className="inline-flex items-center justify-center gap-2 bg-white py-3 px-6 font-medium text-black rounded-sm hover:bg-gray-100 transition-colors duration-300 relative z-10"
          >
            <FaTshirt className="text-lg" />
            Design Your Own T-Shirt
            <FaArrowRight className="ml-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default Home;