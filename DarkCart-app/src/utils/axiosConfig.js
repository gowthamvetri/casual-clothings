import axios from 'axios';
import { getAuthHeader } from '../store/userSlice';

/**
 * Sets up global Axios interceptors for authentication
 * Call this function once when your app initializes
 */
export const setupAxiosInterceptors = () => {
  console.log("Setting up Axios interceptors for authentication");
  
  // Add a request interceptor
  axios.interceptors.request.use(
    (config) => {
      // Get authentication headers using our helper
      const authHeader = getAuthHeader();
      
      // Add the Authorization header to the request if it exists
      if (authHeader.Authorization) {
        config.headers = {
          ...config.headers,
          ...authHeader
        };
        console.log("Axios: Added authentication token to request");
      }
      
      return config;
    },
    (error) => {

      return Promise.reject(error);
    }
  );

  // Add a response interceptor to handle auth errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle 401 Unauthorized errors
      if (error.response && error.response.status === 401) {
        console.error("Authentication error (401): Token might be invalid or expired");
        
        // If you're using React Router for navigation, you could redirect to login
        // window.location.href = '/login';
        
        // Clear invalid token
        localStorage.removeItem('token');
      }
      
      return Promise.reject(error);
    }
  );
};

/**
 * Get the current authentication token
 * @returns {string|null} The authentication token or null if not found
 */
export const getAuthToken = () => {
  // Check for accessToken first (your application's standard)
  // Then fall back to token (used by some components)
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  
  // For compatibility: duplicate accessToken as token if only accessToken exists
  if (localStorage.getItem('accessToken') && !localStorage.getItem('token')) {
    localStorage.setItem('token', localStorage.getItem('accessToken'));
    console.log('Duplicated accessToken as token for compatibility');
  }
  
  return token;
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export const isAuthenticated = () => {
  return !!(localStorage.getItem('accessToken') || localStorage.getItem('token'));
};
