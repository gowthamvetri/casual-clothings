
const CardLoading = () => {
  return (
    <div className='bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 animate-pulse'>
      {/* Product Image Skeleton */}
      <div className='relative w-full aspect-square bg-gray-200'>
        {/* Optional: Add subtle badges placeholders */}
        <div className='absolute top-3 left-3 h-5 w-14 bg-gray-300 rounded'></div>
        <div className='absolute top-3 right-3 h-6 w-12 bg-gray-300 rounded-full'></div>
      </div>
      
      {/* Product Info Skeleton */}
      <div className='p-3 sm:p-4 space-y-3'>
        {/* Brand/Category */}
        <div className='h-3 bg-gray-200 rounded w-1/3'></div>
        
        {/* Product Name - Two lines */}
        <div className='space-y-2'>
          <div className='h-4 bg-gray-200 rounded w-full'></div>
          <div className='h-4 bg-gray-200 rounded w-4/5'></div>
        </div>
        
        {/* Rating */}
        <div className='flex items-center space-x-1'>
          <div className='h-3 w-16 bg-gray-200 rounded'></div>
          <div className='h-3 w-8 bg-gray-200 rounded'></div>
        </div>

        {/* Price and Button */}
        <div className='flex items-center justify-between pt-2'>
          <div className='h-6 bg-gray-300 rounded w-20'></div>
          <div className='h-9 bg-gray-300 rounded w-24'></div>
        </div>
      </div>
    </div>
  )
}

export default CardLoading