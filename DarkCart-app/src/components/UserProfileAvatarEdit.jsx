import React, { useState, useEffect } from "react";
import { FaRegUserCircle } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import Axios from "../utils/Axios.js";
import SummaryApi from "../common/SummaryApi";
import AxiosTostError from "../utils/AxiosTostError.js";
import { updateAvatar } from "../store/userSlice.js";
import { IoClose } from "react-icons/io5";

// CSS for animation
const modalStyles = `
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
`;

const modalAnimation = {
  overlay: {
    animation: 'fadeIn 0.3s ease-out',
  },
  content: {
    animation: 'slideIn 0.3s ease-out'
  }
};

function UserProfileAvatarEdit({ close }) {
  // Add the styles to the document
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = modalStyles;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  const user = useSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    // Validate file type on frontend
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('File size too large. Maximum size is 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    let uploadResponse = null;

    try {
      setLoading(true);
      uploadResponse = await Axios({
        ...SummaryApi.uploadAvatar,
        data: formData,
      });
      
      const { data: responseData } = uploadResponse;
      
      if (responseData.success && responseData.data?.avatar) {
        dispatch(updateAvatar(responseData.data.avatar));
        console.log('Avatar uploaded successfully:', responseData.data.avatar);
        // Optionally close the modal after successful upload
        setTimeout(() => {
          close();
        }, 1000);
      }
    } catch (error) {
      AxiosTostError(error);
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
      if (uploadResponse) {
        console.log('Upload response:', uploadResponse);
      }
    }
  };

  return (
    <section className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center z-50 font-sans" style={modalAnimation.overlay}>
      <div className="bg-white max-w-xs sm:max-w-sm w-full rounded-lg p-4 sm:p-6 flex flex-col justify-center items-center gap-3 sm:gap-4 shadow-xl border border-gray-100" style={modalAnimation.content}>
        {/* Close Button */}
        <div className="flex justify-end w-full">
          <button
            className="text-gray-400 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-opacity-50"
            onClick={close}
            aria-label="Close"
          >
            <IoClose size={20} className="sm:hidden" />
            <IoClose size={24} className="hidden sm:block" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-1 sm:mb-2">
          <h3 className="font-bold text-base sm:text-lg text-gray-900 tracking-wider">
            Profile Photo
          </h3>
          <p className="text-gray-600 text-xs sm:text-sm tracking-wide">Upload your profile picture</p>
        </div>

        {/* Profile Avatar */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex justify-center items-center overflow-hidden border-4 border-gray-100 shadow-md">
          {user.avatar ? (
            <img
              alt={user.name}
              src={user.avatar}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <FaRegUserCircle size={50} className="text-gray-400 sm:hidden" />
              <FaRegUserCircle size={65} className="text-gray-400 hidden sm:block" />
            </>
          )}
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="w-full mt-1">
          <label htmlFor="uploadAvatar" className="block">
            <div className="bg-black hover:bg-gray-800 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-md cursor-pointer font-semibold tracking-wider transition-all text-center text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-opacity-50">
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </span>
              ) : "Upload Photo"}
            </div>
          </label>
          <input
            type="file"
            id="uploadAvatar"
            className="hidden"
            onChange={handleUploadAvatar}
            accept="image/*"
          />
        </form>

        {/* Additional Info */}
        <p className="text-xs text-gray-500 text-center leading-relaxed tracking-wide mt-1">
          Recommended: Square image, at least 200x200px
        </p>
      </div>
    </section>
  );
}

export default UserProfileAvatarEdit;
