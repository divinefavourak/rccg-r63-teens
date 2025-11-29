import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Define the shape of your Auth Context/Hook return value
interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const auth = localStorage.getItem("adminAuth");
    const loginTime = localStorage.getItem("adminLoginTime");
    
    if (auth && loginTime) {
      const loginDate = new Date(loginTime);
      const now = new Date();
      const hoursDiff = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        setIsAuthenticated(true);
      } else {
        // Session expired
        logout();
      }
    } else {
      setIsAuthenticated(false);
    }
    
    setIsLoading(false);
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    // Admin credentials (In a real app, verify against backend)
    const ADMIN_CREDENTIALS = {
      username: "admin@rccg63",
      password: "R63Teens2025!"
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      localStorage.setItem("adminAuth", "true");
      localStorage.setItem("adminLoginTime", new Date().toISOString());
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("adminAuth");
    localStorage.removeItem("adminLoginTime");
    setIsAuthenticated(false);
    navigate('/admin-login');
  };

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth
  };
};