// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Environment detection
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'; 