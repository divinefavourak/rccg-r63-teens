import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock Database
const COORDINATORS: User[] = [
  { id: 'c1', username: 'lp9@faithtribe', role: 'coordinator', province: 'Lagos Province 9', name: 'Pst. LP 9 Coord' },
  { id: 'c2', username: 'lp28@faithtribe', role: 'coordinator', province: 'Lagos Province 28', name: 'Pst. LP 28 Coord' },
  { id: 'c3', username: 'lp69@faithtribe', role: 'coordinator', province: 'Lagos Province 69', name: 'Pst. LP 69 Coord' },
  { id: 'c4', username: 'lp84@faithtribe', role: 'coordinator', province: 'Lagos Province 84', name: 'Pst. LP 84 Coord' },
  { id: 'c5', username: 'lp86@faithtribe', role: 'coordinator', province: 'Lagos Province 86', name: 'Pst. LP 86 Coord' },
  { id: 'c6', username: 'lp104@faithtribe', role: 'coordinator', province: 'Lagos Province 104', name: 'Pst. LP 104 Coord' },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check login status on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("rccg_user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem("rccg_user");
        }
      } catch (e) {
        localStorage.removeItem("rccg_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Fake delay

    // 1. Check Admin
    if (username === "admin@rccg63" && password === "R63Teens2025!") {
      const adminUser: User = { id: 'admin', username, role: 'admin', name: 'Regional Admin' };
      saveUser(adminUser);
      return true;
    }

    // 2. Check Coordinators
    const coordinator = COORDINATORS.find(c => c.username === username.toLowerCase());
    if (coordinator && password === "faithtribe2025") {
      saveUser(coordinator);
      return true;
    }

    return false;
  };

  const saveUser = (userData: User) => {
    localStorage.setItem("rccg_user", JSON.stringify(userData));
    setUser(userData);
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