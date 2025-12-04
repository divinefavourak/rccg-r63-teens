import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://rccg-r63-teens-backend.onrender.com/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to inject token if available
api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('rccg_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      // Check if user object has a token property (adjust based on your actual login response)
      if (user.token || user.access) {
        config.headers.Authorization = `Bearer ${user.token || user.access}`;
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }
  return config;
});