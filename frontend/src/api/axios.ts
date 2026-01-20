import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const userStr = localStorage.getItem('rccg_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user?.token) {
                    config.headers.Authorization = `Bearer ${user.token}`;
                }
            } catch (e) {
                console.error("Error parsing user token:", e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh (Simple Implementation)
// For now, we'll just logout on 401 to keep it simple, 
// or implement a basic refresh flow if you prefer.
// Consistent with user request "Auto-refresh access token when expired"
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response) {
            // Handle specific status codes
            switch (error.response.status) {
                case 400:
                    // Bad Request - often validation errors
                    // Optionally handle validation errors globally or let components handle them
                    break;
                case 401:
                    // Unauthorized - Handle Token Refresh
                    if (!originalRequest._retry) {
                        originalRequest._retry = true;
                        const userStr = localStorage.getItem('rccg_user');
                        if (userStr) {
                            try {
                                const user = JSON.parse(userStr);
                                const refreshToken = user.refreshToken;
                                if (refreshToken) {
                                    const { data } = await axios.post(`${API_URL}/auth/token/refresh/`, { refresh: refreshToken });
                                    const newUser = { ...user, token: data.access };
                                    localStorage.setItem('rccg_user', JSON.stringify(newUser));
                                    originalRequest.headers.Authorization = `Bearer ${data.access}`;
                                    return api(originalRequest);
                                }
                            } catch (refreshError) {
                                localStorage.removeItem('rccg_user');
                                window.location.href = '/login';
                                return Promise.reject(refreshError);
                            }
                        }
                    }
                    break;
                case 403:
                    // Forbidden
                    // toast.error("You do not have permission to perform this action.");
                    break;
                case 404:
                    // Not Found
                    // toast.error("The requested resource was not found.");
                    break;
                case 500:
                    // Server Error
                    // toast.error("An unexpected server error occurred. Please try again later.");
                    break;
                default:
                    break;
            }
        } else if (error.request) {
            // Network Error (no response)
            // toast.error("Network error. Please check your internet connection.");
        }

        return Promise.reject(error);
    }
);

export default api;
