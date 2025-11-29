import { useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom'; // <--- Import useNavigate

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate(); // <--- Initialize hook

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Use navigate() instead of window.location.href
      // This prevents the "404 Not Found" server error
      navigate('/admin-login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a0505] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-yellow-500/80 font-bold">Verifying Access...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Return null while redirecting to avoid flash of content
    return null; 
  }

  return <>{children}</>;
};

export default ProtectedRoute;