import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/axios';
import { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await api.post<AuthResponse>('/auth/login/', credentials);
      const { access, refresh, user: userData } = response.data;

      const userWithToken = { ...userData, token: access, refreshToken: refresh };

      localStorage.setItem("rccg_user", JSON.stringify(userWithToken));
      setUser(userWithToken);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
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
  };

  const logout = () => {
    localStorage.removeItem("rccg_user");
    setUser(null);
    window.location.href = '/login';
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      // Assuming generic /auth/profile endpoint
      const response = await api.patch('/auth/profile/', data);

      if (user) {
        const updatedUser = { ...user, ...response.data };
        localStorage.setItem("rccg_user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within an AuthProvider");
  return context;
};