import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - WebP format support with fallback
 * - Responsive images with srcset
 * - Blur-up placeholder effect
 * - Error handling with fallback
 */
const OptimizedImage = ({
  src,
  alt,
  className = '',
  width,
  height,
  sizes,
  loading = 'lazy',
  priority = false,
  objectFit = 'cover',
  placeholder = 'blur',
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder.jpg'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority || loading === 'eager');
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Generate WebP source with fallback
  const getWebPSource = (imageSrc) => {
    if (!imageSrc || hasError) return fallbackSrc;
    
    // Check if it's already a WebP
    if (imageSrc.endsWith('.webp')) return imageSrc;
    
    // For Cloudinary images, add WebP transformation
    if (imageSrc.includes('cloudinary.com')) {
      return imageSrc.replace(/\.(jpg|jpeg|png)/, '.webp');
    }
    
    return imageSrc;
  };

  // Generate srcset for responsive images
  const generateSrcSet = (imageSrc) => {
    if (!imageSrc || hasError) return '';
    
    // For Cloudinary, generate different sizes
    if (imageSrc.includes('cloudinary.com')) {
      const widths = [320, 640, 768, 1024, 1280, 1536];
      return widths
        .map(w => {
          const resizedUrl = imageSrc.replace(
            '/upload/',
            `/upload/w_${w},f_auto,q_auto/`
          );
          return `${resizedUrl} ${w}w`;
        })
        .join(', ');
    }
    
    return '';
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager' || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, loading]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    setIsLoaded(true);
    onError?.(e);
  };

  const webpSrc = getWebPSource(src);
  const fallbackImage = hasError ? fallbackSrc : src;
  const srcSet = generateSrcSet(webpSrc);

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Blur placeholder */}
      {!isLoaded && placeholder === 'blur' && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ filter: 'blur(10px)' }}
        />
      )}

      {/* Main image - only render when in view */}
      {isInView && (
        <picture>
          {/* WebP source for modern browsers */}
          {!hasError && webpSrc !== src && (
            <source
              type="image/webp"
              srcSet={srcSet || webpSrc}
              sizes={sizes}
            />
          )}
          
          {/* Fallback to original format */}
          <img
            src={fallbackImage}
            alt={alt}
            srcSet={!hasError && srcSet ? srcSet : undefined}
            sizes={sizes}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ objectFit }}
          />
        </picture>
      )}

      {/* Loading spinner */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

OptimizedImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sizes: PropTypes.string,
  loading: PropTypes.oneOf(['lazy', 'eager']),
  priority: PropTypes.bool,
  objectFit: PropTypes.oneOf(['contain', 'cover', 'fill', 'none', 'scale-down']),
  placeholder: PropTypes.oneOf(['blur', 'none']),
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  fallbackSrc: PropTypes.string
};

export default OptimizedImage;
