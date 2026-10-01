import axios, { type AxiosInstance } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/**
 * The un-versioned base, for the endpoints that only exist there.
 *
 * `backend/urls.py` mounts `tickets.urls` at `api/` and never under `api/v1/`,
 * so ticket and legacy payment calls must not carry the `/v1` segment. Derived
 * from API_URL rather than configured separately, so a single environment
 * variable still controls the host.
 */
export const LEGACY_API_URL = API_URL.replace(/\/v1\/?$/, '');

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * In-flight refresh, shared by every request that 401s at the same time.
 *
 * A page load fires several requests at once. When the access token has expired
 * they all 401 together, and without this lock each one started its own refresh
 * — N refresh calls for one expired token, with the later ones racing to
 * overwrite localStorage using a refresh token the first call may already have
 * rotated. The first 401 now performs the refresh and the rest await the same
 * promise.
 */
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const userStr = localStorage.getItem('rccg_user');
        if (!userStr) throw new Error('No session to refresh');

        const user = JSON.parse(userStr);
        const refreshToken = user.refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        // Plain axios, not `api`: routing this through the instance would send it
        // back through this same interceptor and recurse on a failed refresh.
        const { data } = await axios.post(`${API_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
        });
        localStorage.setItem('rccg_user', JSON.stringify({ ...user, token: data.access }));
        return data.access as string;
    })();

    // Clear the lock either way, so a later 401 can start a fresh attempt rather
    // than awaiting a settled promise forever.
    refreshPromise.finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

/**
 * Attach the shared auth behaviour to an axios instance.
 *
 * There used to be two clients — this one and `services/api.ts` — each with its
 * own request interceptor, and only this one handling 401 refresh. Two
 * descriptions of "how we authenticate" is a correctness hazard, not just
 * duplication: a ticket call whose token had expired simply failed. Both
 * instances now share this one implementation and differ only in base URL.
 */
export function attachAuth(client: AxiosInstance) {
// Request Interceptor: Attach Token
client.interceptors.request.use(
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

client.interceptors.response.use(
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
                    // Unauthorized — refresh once, then replay the request.
                    if (!originalRequest._retry && localStorage.getItem('rccg_user')) {
                        originalRequest._retry = true;
                        try {
                            const access = await refreshAccessToken();
                            originalRequest.headers.Authorization = `Bearer ${access}`;
                            return client(originalRequest);
                        } catch (refreshError) {
                            // The session is genuinely gone. Clear it and let the
                            // app route to login.
                            //
                            // This used to be `window.location.href = '/login'`,
                            // a full page reload that re-downloaded the entire
                            // bundle. Dispatching an event lets AuthContext reset
                            // state and the router navigate in-place instead.
                            localStorage.removeItem('rccg_user');
                            window.dispatchEvent(new CustomEvent('auth:session-expired'));
                            return Promise.reject(refreshError);
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
}

attachAuth(api);

export default api;
