import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import axios from 'axios';
import { useSelector } from 'react-redux'; // Import useSelector from react-redux
import { baseURL } from '../common/SummaryApi.js';

const MySwal = withReactContent(Swal);

function Contact() {
  const navigate = useNavigate();
  const contactFormRef = React.useRef(null);
  
  // Get user state from Redux store
  const user = useSelector(state => state.user);
  const isLoggedIn = !!user._id; // User is logged in if they have an _id
  
  // Scroll to form when component mounts if #contact anchor is in the URL
  useEffect(() => {
    if (window.location.hash === '#contact' && contactFormRef.current) {
      setTimeout(() => {
        contactFormRef.current.scrollIntoView({ behavior: 'smooth' });
        contactFormRef.current.querySelector('input, textarea').focus();
      }, 500);
    }
  }, []);
  
  // Default store location
  const [storeLocation] = useState({
    name: "Casual Clothings Headquarters",
    address: "Sivsakthi Nagar, 5th Street, Tirupur, Tamil Nadu - 641604"
  });

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  // Set initial form data from user info if logged in
  useEffect(() => {
    if (isLoggedIn) {
      setFormData(prev => ({
        ...prev,
        fullName: user.name || '',
        email: user.email || ''
      }));
    }
  }, [isLoggedIn, user]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission with authentication check
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if user is logged in
    if (!isLoggedIn) {
      // Show login prompt
      const result = await MySwal.fire({
        title: "Authentication Required",
        text: "Please log in to send us a message",
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Log in",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#111827",
        cancelButtonColor: "#6B7280",
      });

      // Redirect to login if they click "Log in"
      if (result.isConfirmed) {
        navigate("/login", { 
          state: { from: "/contact", returnToForm: true } 
        });
      }
      return; // Stop execution if not logged in
    }

    // Proceed with form submission if logged in
    setIsSubmitting(true);
    setSubmitProgress(0);
    
    // Create a visual progress indicator
    const progressInterval = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 5, 90));
    }, 300);

    try {
      // Get token from localStorage - check both accessToken and token
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      const response = await axios({
        method: 'post',
        url: `${baseURL}/api/contact/send`,
        data: formData,
        timeout: 30000,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Origin": window.location.origin 
        }
      });
      
      clearInterval(progressInterval);
      
      if (!response.data || response.status !== 200) {
        throw new Error(`Server returned ${response.status}: ${response.statusText || 'Failed to send message'}`);
      }

      // Set to 100% when we're sure the request succeeded
      setSubmitProgress(100);
      
      // Show success message after a small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await MySwal.fire({
        icon: "success",
        title: "Message sent successfully!",
        text: "Thank you for reaching out. We'll get back to you soon.",
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        background: "#ffffff",
        color: "#000000"
      });
      
      // Redirect to the history page to see all messages including this one
      await MySwal.fire({
        icon: "info",
        title: "View your message history?",
        text: "Would you like to see all your messages?",
        showCancelButton: true,
        confirmButtonText: "Yes, show my messages",
        cancelButtonText: "No, stay here",
        confirmButtonColor: "#111827",
      }).then((result) => {
        if (result.isConfirmed) {
          navigate("/contact-history");
        }
      });

      // Reset form fields except user info
      setFormData(prev => ({
        ...prev,
        subject: "",
        message: ""
      }));
      
    } catch (error) {
      clearInterval(progressInterval);
      setSubmitProgress(0);
      
      // Handle auth errors
      if (error.response && error.response.status === 401) {
        await MySwal.fire({
          icon: "error",
          title: "Authentication Error",
          text: "Your session has expired. Please log in again.",
          confirmButtonText: "Log In",
          background: "#ffffff",
          color: "#000000"
        });
        navigate("/login");
        return;
      }
      
      // Handle token not found error
      if (error.message === 'Authentication token not found. Please log in again.') {
        await MySwal.fire({
          icon: "error",
          title: "Authentication Required",
          text: "Please log in again to send your message.",
          confirmButtonText: "Log In",
          background: "#ffffff",
          color: "#000000"
        });
        navigate("/login");
        return;
      }
      
      const errorMessage = error.code === 'ECONNABORTED' 
        ? "Request timed out. The server might be busy. Please try again later."
        : error.message || "Something went wrong";
      
      console.error("Form submission error:", error);
      
      await MySwal.fire({
        icon: "error",
        title: "Submission failed",
        text: errorMessage,
        confirmButtonText: "Try Again",
        background: "#ffffff",
        color: "#000000"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render contact form with login check
  const renderContactForm = () => (
    <div className="w-full">
      <h3 className="text-2xl font-bold mb-6 font-['Playfair_Display'] text-gray-800 relative">
        Send Us a Message
        <span className="absolute bottom-0 left-0 w-16 h-1 bg-gray-900 rounded-full mt-2"></span>
      </h3>
      
      {!isLoggedIn ? (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2 font-['Playfair_Display']">Authentication Required</h4>
          <p className="text-gray-600 mb-6 font-['Poppins']">
            Please log in to send us a message. We value your feedback and will respond promptly.
          </p>
          <Link 
            to="/login"
            className="inline-flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-gray-900 hover:bg-gray-800 font-['Poppins']"
          >
            Log In to Continue
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-gray-500 font-['Poppins']">
            Don't have an account? <Link to="/register" className="text-gray-900 font-medium hover:underline">Sign up</Link>
          </p>
        </div>
      ) : (
        <form ref={contactFormRef} onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-b from-white to-gray-50 p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label htmlFor="fullName" className="flex text-sm font-medium text-gray-700 font-['Poppins'] items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Full Name
              </label>
              <input 
                type="text" 
                id="fullName" 
                name="fullName" 
                value={formData.fullName}
                onChange={handleChange}
                required
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm font-['Poppins'] transition-all hover:border-gray-400"
                placeholder="Your name"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="email" className="flex text-sm font-medium text-gray-700 font-['Poppins'] items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Email Address
              </label>
              <input 
                type="email" 
                id="email" 
                name="email"
                value={formData.email}
                onChange={handleChange} 
                required
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm font-['Poppins'] transition-all hover:border-gray-400"
                placeholder="your.email@example.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="subject" className="flex text-sm font-medium text-gray-700 font-['Poppins'] items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd" />
              </svg>
              Subject
            </label>
            <input 
              type="text" 
              id="subject" 
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm font-['Poppins'] transition-all hover:border-gray-400"
              placeholder="What is your message about?"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="message" className="flex text-sm font-medium text-gray-700 font-['Poppins'] items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
              </svg>
              Message
            </label>
            <textarea 
              id="message" 
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="4" 
              required
              placeholder="How can we help you today?"
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm font-['Poppins'] transition-all hover:border-gray-400"
            ></textarea>
            <p className="text-xs text-gray-500 mt-1 font-['Poppins']">Please provide as much detail as possible so we can best assist you</p>
          </div>
          
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="relative overflow-hidden inline-flex justify-center items-center w-full py-3 px-6 border border-transparent shadow-md text-sm font-medium rounded-lg text-white bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 font-['Poppins'] transition-all duration-300"
            >
              {/* Progress bar for submission */}
              {isSubmitting && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-gray-400 to-gray-600" 
                  style={{ width: `${submitProgress}%`, transition: 'width 0.3s ease-in-out' }}
                ></div>
              )}
              
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Sending ({submitProgress}%)...
                </>
              ) : (
                <>
                  Send Message
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="ml-2 -mr-1 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
          
          {/* User info indicator */}
          <div className="mt-4 bg-gray-50 rounded-lg border border-gray-100 p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="bg-green-100 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-['Poppins'] font-medium">Logged in as <span className="text-gray-800">{user.name}</span></span>
              </div>
              
              <Link 
                to="/contact-history" 
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-all duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
                </svg>
                View message history
              </Link>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gray-900 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-['Playfair_Display'] mb-4">Contact Us</h1>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto font-['Poppins']">
              We'd love to hear from you. Reach out with any questions or feedback about our products.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title */}
        <div className='bg-white shadow-sm p-4 mb-6 flex items-center justify-between rounded-lg border-b border-gray-200'>
          <h1 className='text-xl font-bold text-gray-900 font-["Playfair_Display"]'>Contact Our Team</h1>
        </div>
        
        {/* Contact Form - with Redux-based authentication check */}
        <div className="mb-16">
        
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 relative overflow-hidden border border-gray-100">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iLjA1Ij48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00bTAtMTZjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00bTE2IDE2YzAtMi4yIDEuOC00IDQtNHM0IDEuOCA0IDQtMS44IDQtNCA0LTQtMS44LTQtNG0tMTYtMTZjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00bS04IDhWMGg0djh6bTAgNDB2LThoNHY4em0wLTI0di04aDR2OHoiLz48L2c+PC9nPjwvc3ZnPg==')] bg-[length:30px_30px] pointer-events-none"></div>

            <div className="flex flex-col md:flex-row gap-8 relative z-10 w-full">
              {/* Contact form with Redux auth check */}
              <div className="w-full md:w-1/2 order-2 md:order-1">
                {renderContactForm()}
              </div>

              <div className="w-full md:w-1/2 mt-0 md:mt-0 order-1 md:order-2">
                <h3 className="text-2xl font-bold mb-6 font-['Playfair_Display'] text-gray-800 relative">
                  Connect With Us
                  <span className="absolute bottom-0 left-0 w-16 h-1 bg-gray-900 rounded-full mt-2"></span>
                </h3>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4 group p-4 rounded-lg transition-all hover:bg-gray-50 hover:shadow-sm">
                    <div className="bg-gradient-to-br from-gray-700 to-gray-900 p-3 rounded-lg shadow-md text-white">
                      <FaEnvelope className="h-6 w-6 transition-transform group-hover:scale-110" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base font-['Playfair_Display'] text-gray-800">Email</h4>
                      <a 
                        href="mailto:casualclothing787@gmail.com" 
                        className="text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1 font-['Poppins'] group-hover:underline"
                      >
                      casualclothing787@gmail.com
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4 group p-4 rounded-lg transition-all hover:bg-gray-50 hover:shadow-sm">
                    <div className="bg-gradient-to-br from-gray-700 to-gray-900 p-3 rounded-lg shadow-md text-white">
                      <FaMapMarkerAlt className="h-6 w-6 transition-transform group-hover:scale-110" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base font-['Playfair_Display'] text-gray-800">Location</h4>
                      <p className="text-gray-600 font-['Poppins'] group-hover:text-gray-800">
                        Sivsakthi Nagar, 5th Street, Tirupur, Tamil Nadu - 641604
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4 group p-4 rounded-lg transition-all hover:bg-gray-50 hover:shadow-sm">
                    <div className="bg-gradient-to-br from-gray-700 to-gray-900 p-3 rounded-lg shadow-md text-white">
                      <FaPhone className="h-6 w-6 transition-transform group-hover:scale-110" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base font-['Playfair_Display'] text-gray-800">Phone</h4>
                      <p className="text-gray-600 font-['Poppins'] group-hover:text-gray-800">+91 9442955929</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 rounded-lg border border-gray-100 bg-gray-50 shadow-sm">
                    <h4 className="font-bold text-base mb-3 font-['Playfair_Display'] text-gray-800 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      Business Hours
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-md">
                      <div className="border-l-4 border-gray-900 pl-3 py-1">
                        <span className="block text-sm font-medium text-gray-700 font-['Poppins']">Monday - Saturday</span>
                        <span className="block text-gray-900 font-['Poppins'] font-bold">10:00 AM - 8:00 PM</span>
                      </div>
                      <div className="border-l-4 border-gray-400 pl-3 py-1">
                        <span className="block text-sm font-medium text-gray-700 font-['Poppins']">Sunday</span>
                        <span className="block text-gray-900 font-['Poppins'] font-bold">11:00 AM - 5:00 PM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Map Section */}
        <div className="mb-16">
          <div className='bg-white shadow-sm p-4 mb-6 flex items-center justify-between rounded-lg border-b border-gray-200'>
            <h2 className='text-xl font-bold text-gray-900 font-["Playfair_Display"]'>Our Location</h2>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4 overflow-hidden">
            <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d125323.16899423013!2d77.2791009243364!3d11.107926535324067!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba907b0424b8edf%3A0x2b29d00e11b7a337!2sTirupur%2C%20Tamil%20Nadu!5e0!3m2!1sen!2sin!4v1716371645387!5m2!1sen!2sin"
                width="100%" 
                height="450" 
                style={{ border: 0 }} 
                allowFullScreen="" 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="Casual Clothings Store Location"
                className="rounded-lg shadow-inner"
              ></iframe>
            </div>
            <div className="mt-6 text-center">
              <p className="text-gray-600 font-['Poppins']">Visit our store at Sivsakthi Nagar, 5th Street, Tirupur, Tamil Nadu - 641604</p>
              <a 
                href="https://goo.gl/maps/J2cX5DG4koH8vTjM8" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center mt-3 text-gray-900 hover:text-gray-700 font-['Poppins'] font-medium"
              >
                Get Directions
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}

export default Contact;