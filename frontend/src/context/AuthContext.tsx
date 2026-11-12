import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import api from '../api/axios';
import type { User, LoginCredentials, RegisterCredentials, AuthResponse, AgeGroup } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsGender: boolean;
  ageGroup: AgeGroup;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  /** Re-read the account after a photo upload or a profile edit. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Merge account fields without losing a token the interceptor just renewed.
 *
 * `api` refreshes an expired access token in localStorage before replaying a
 * 401. The `current` value in React state can still be the pre-refresh copy;
 * writing that back would put the old token in storage and make the next
 * request refresh again — or, if the refresh token rotated, end the session.
 */
function mergeWithLatestSession(current: User, changes: Partial<User>): User {
  try {
    const raw = localStorage.getItem("rccg_user");
    if (raw) {
      const latest = JSON.parse(raw) as User;
      if (latest?.id === current.id) {
        return {
          ...current,
          ...changes,
          token: latest.token ?? current.token,
          refreshToken: latest.refreshToken ?? current.refreshToken,
        };
      }
    }
  } catch {
    // A corrupt store is handled by the sign-in path, not here.
  }
  return { ...current, ...changes };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsGender, setNeedsGender] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem("rccg_user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser?.token) {
            // Optional: Validate token with backend here if needed
            // await api.get('/auth/me/');
            setUser(parsedUser);
          } else {
            localStorage.removeItem("rccg_user");
          }
        } catch (e) {
          console.error("Auth initialization error", e);
          localStorage.removeItem("rccg_user");
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  /*
    The axios interceptor raises this when a token refresh fails, instead of
    doing `window.location.href = '/login'` — that was a full page reload, so an
    expired token cost the user a re-download of the entire bundle on a metered
    connection. Clearing state here lets ProtectedRoute redirect in-place.
  */
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await api.post<AuthResponse>('/auth/login/', credentials);
      const { access, refresh, user: userData, needs_gender } = response.data;

      const userWithToken = { ...userData, token: access, refreshToken: refresh };

      localStorage.setItem("rccg_user", JSON.stringify(userWithToken));
      setUser(userWithToken);
      setNeedsGender(!!needs_gender);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      await api.post('/auth/register/', credentials);
      // Auto-login after register? Or redirect to login? 
      // For now, let's assume we redirect to login manually or auto-login.
      // Implementing auto-login:
      await login({ username: credentials.username, password: credentials.password });
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem("rccg_user");
    setUser(null);
    // Same reasoning as the session-expired path: clearing state is enough for
    // ProtectedRoute to redirect, and avoids a full-bundle reload.
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
  }, []);

  const ageGroup: AgeGroup = (user?.age_group as AgeGroup) || '';

  const updateProfile = useCallback(async (data: Partial<User>) => {
    try {
      const response = await api.patch('/auth/me/', data);

      setUser((current) => {
        if (!current) return current;
        const updatedUser = mergeWithLatestSession(current, response.data);
        localStorage.setItem("rccg_user", JSON.stringify(updatedUser));
        return updatedUser;
      });
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  }, []);

  /**
   * Re-read the account.
   *
   * A photo uploaded to the teen profile is mirrored onto the account by the
   * API, but the copy in localStorage (and therefore in every header) is the
   * one read at sign-in. Fetching it again is what makes the new picture appear
   * without a reload.
   */
  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>('/auth/me/');
    setUser((current) => {
      if (!current) return current;
      const updatedUser = mergeWithLatestSession(current, data);
      localStorage.setItem("rccg_user", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  /*
    Previously a fresh object literal on every render, with four freshly-created
    callbacks inside it — so every consumer of this context re-rendered whenever
    anything above the provider did, which is every navigation.
  */
  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, needsGender, ageGroup, login, register, logout, updateProfile, refreshUser }),
    [user, isLoading, needsGender, ageGroup, login, register, logout, updateProfile, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within an AuthProvider");
  return context;
};