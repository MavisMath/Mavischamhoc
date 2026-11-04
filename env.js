// Runtime Environment Configuration for Frontend
// Tự động nạp cấu hình biến môi trường từ .env cho ứng dụng web
window.ENV = window.ENV || {};

// Google OAuth Client ID từ .env
window.ENV.VITE_GOOGLE_CLIENT_ID = "867845907918-8mt3p30up2f9hhrfs8o2rmmbr7f86gu3.apps.googleusercontent.com";
window.ENV.REACT_APP_GOOGLE_CLIENT_ID = "867845907918-8mt3p30up2f9hhrfs8o2rmmbr7f86gu3.apps.googleusercontent.com";

// Google Gemini API Key cho AI Geometry Compiler & Math Solver (Ưu tiên gọi API)
window.ENV.VITE_GEMINI_API_KEY = (typeof localStorage !== 'undefined' && localStorage.getItem('padlet_gemini_api_key')) || 
                                 (typeof window !== 'undefined' && window.__LOCAL_GEMINI_KEY) || "";
window.ENV.REACT_APP_GEMINI_API_KEY = window.ENV.VITE_GEMINI_API_KEY;
