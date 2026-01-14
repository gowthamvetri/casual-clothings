import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

/**
 * PWA Update Component
 * 
 * Handles service worker registration and update notifications
 * Uses workbox-window directly for better compatibility
 */
const PWAUpdatePrompt = () => {
  const [showReload, setShowReload] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    // Only register service worker in production
    if (import.meta.env.MODE !== 'production') {
      return;
    }

    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      // Dynamically import Workbox to avoid build errors
      import('workbox-window').then(({ Workbox }) => {
        const wb = new Workbox('/sw.js');

        // Handle service worker waiting
        wb.addEventListener('waiting', () => {
          setShowReload(true);
          setRegistration(wb);
        });

        // Handle service worker activation
        wb.addEventListener('activated', (event) => {
          // Reload the page if this is a new service worker taking over
          if (!event.isUpdate) {
            toast.success('App is ready to work offline!', {
              duration: 3000,
              icon: '📱',
            });
          }
        });

        // Handle offline ready
        wb.addEventListener('installed', (event) => {
          if (!event.isUpdate) {
            toast.success('App is ready to work offline!', {
              duration: 3000,
              icon: '📱',
            });
          }
        });

        // Register the service worker
        wb.register().catch((error) => {
          console.log('SW registration failed:', error);
        });

        // Check for updates every hour
        setInterval(() => {
          wb.update();
        }, 60 * 60 * 1000);
      }).catch((error) => {
        console.log('Workbox import failed:', error);
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration) {
      // Tell the service worker to skip waiting
      registration.messageSkipWaiting();
      setShowReload(false);
      // Reload the page
      window.location.reload();
    }
  };

  const close = () => {
    setShowReload(false);
  };

  if (!showReload) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-black rounded-lg shadow-lg p-4 max-w-sm z-50 animate-slide-in">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            Update Available
          </h3>
          <p className="text-sm text-gray-600">
            A new version of the app is available. Reload to get the latest features and fixes.
          </p>
        </div>
        <button
          onClick={close}
          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleUpdate}
          className="flex-1 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          Reload Now
        </button>
        <button
          onClick={close}
          className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Later
        </button>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
