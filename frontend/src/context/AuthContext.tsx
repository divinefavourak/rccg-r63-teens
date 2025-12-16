import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use the Vite environment variable for the API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check login status on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("rccg_user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Ensure the user has a token before setting state
        if (parsedUser && (parsedUser.token || parsedUser.access)) {
          setUser(parsedUser);
        } else {
          // Invalid user data, clear it
          localStorage.removeItem("rccg_user");
        }
      } catch (e) {
        localStorage.removeItem("rccg_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Call the real Backend Login Endpoint
      const response = await axios.post(`${API_URL}/auth/login/`, {
        username,
        password
      });

      // The backend returns { access, refresh, user: { ... } }
      const { access, refresh, user: userData } = response.data;
      
      // Merge the token into the user object so we can use it later
      const userWithToken: User = {
        ...userData,
        token: access, // ✅ CRITICAL: Save the token here!
        refreshToken: refresh
      };

      // Save to LocalStorage and State
      localStorage.setItem("rccg_user", JSON.stringify(userWithToken));
      setUser(userWithToken);
      
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("rccg_user");
    setUser(null);
    window.location.href = '/'; 
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within an AuthProvider");
  return context;
};