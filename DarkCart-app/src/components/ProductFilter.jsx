import React from 'react';
import { FaFilter, FaTimes } from 'react-icons/fa';

const ProductFilter = ({ filters, onFilterChange, showGenderFilter = true, initialGender = '' }) => {
    const genderOptions = [
        { value: "", label: "All Genders" },
        { value: "Men", label: "Men" },
        { value: "Women", label: "Women" },
        { value: "Kids", label: "Kids" }
    ];

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-20 max-h-[calc(100vh-80px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="flex items-center gap-2 mb-6">
                <FaFilter className="w-5 h-5 text-gray-700" />
                <h3 className="font-bold text-gray-900 text-lg">Filters</h3>
            </div>
            
            {/* Gender Filter - Only show if no initial gender or showGenderFilter is true */}
            {showGenderFilter && (
                <div className="mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        Gender Category
                    </h4>
                    <div className="space-y-3">
                        {genderOptions.map(option => (
                            <label key={option.value} className="flex items-center cursor-pointer group">
                                <input
                                    type="radio"
                                    name="gender"
                                    value={option.value}
                                    checked={filters.gender === option.value}
                                    onChange={(e) => onFilterChange('gender', e.target.value)}
                                    className="h-4 w-4 text-black focus:ring-black focus:ring-2 border-gray-300 transition-all duration-200"
                                />
                                <span className="ml-3 text-sm text-gray-700 group-hover:text-black transition-colors duration-200">
                                    {option.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Price Range Filter */}
            <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">Price Range</h4>
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="number"
                                placeholder="Min ₹"
                                value={filters.minPrice}
                                onChange={(e) => onFilterChange('minPrice', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                            />
                        </div>
                        <div className="flex items-center text-gray-400 px-2">
                            to
                        </div>
                        <div className="flex-1">
                            <input
                                type="number"
                                placeholder="Max ₹"
                                value={filters.maxPrice}
                                onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 text-sm"
                            />
                        </div>
                    </div>
                    
                    {/* Quick Price Ranges */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {[
                            { label: "Under ₹500", min: "", max: "500" },
                            { label: "₹500-₹1000", min: "500", max: "1000" },
                            { label: "₹1000-₹2000", min: "1000", max: "2000" },
                            { label: "Above ₹2000", min: "2000", max: "" }
                        ].map((range) => (
                            <button
                                key={range.label}
                                onClick={() => {
                                    onFilterChange('priceRange', range.min, range.max);
                                }}
                                className={`px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                                    filters.minPrice === range.min && filters.maxPrice === range.max
                                        ? 'bg-black text-white border-black'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Clear Filters */}
            <div className="pt-4 border-t border-gray-200">
                <button
                    onClick={() => onFilterChange('clear')}
                    className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
                >
                    <FaTimes className="w-4 h-4" />
                    Clear Price Filters
                </button>
            </div>
        </div>
    );
};

export default ProductFilter;