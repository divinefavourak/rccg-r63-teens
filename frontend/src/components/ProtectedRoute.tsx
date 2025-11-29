import { useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'coordinator')[]; // Optional: Restrict by role
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Redirect logic...
      } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        // Role mismatch redirect logic
        // THIS is crucial: If I am a coordinator trying to go to /admin, send me to dashboard
        if (user.role === 'coordinator') navigate('/coordinator/dashboard', { replace: true });
        else if (user.role === 'admin') navigate('/admin', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate, location, user, allowedRoles]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a0505] flex items-center justify-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-yellow-500/80 font-bold">Verifying Access...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
};

export default ProtectedRoute;