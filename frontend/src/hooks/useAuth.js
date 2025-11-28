import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
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
      const hoursDiff = (now - loginDate) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        setIsAuthenticated(true);
      } else {
        // Session expired
        localStorage.removeItem("adminAuth");
        localStorage.removeItem("adminLoginTime");
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    
    setIsLoading(false);
  };

  const login = async (username, password) => {
    // Admin credentials
    console.log('Login attempt with:', username);
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
    if (success) {
        console.log('Login successful, setting auth state');
        setIsAuthenticated(true);
      }
      return success;
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