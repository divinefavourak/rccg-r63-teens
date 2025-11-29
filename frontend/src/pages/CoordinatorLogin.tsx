import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaUser, FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";

const CoordinatorLogin = () => {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIX: Redirect based on specific ROLE
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === 'coordinator') {
        navigate('/coordinator/dashboard', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      }
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const success = await login(formData.username, formData.password);
      if (success) {
        toast.success("Login Successful");
        // The useEffect will handle the redirection
      } else {
        toast.error("Invalid credentials.");
      }
    } catch (error) {
      toast.error("Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a0505] relative flex flex-col justify-between overflow-hidden">
      <Navbar />
      
      <div className="absolute inset-0 bg-gradient-to-b from-red-950 via-[#2b0303] to-black opacity-90 z-0"></div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10 pt-28">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="glass-effect rounded-2xl shadow-2xl p-8 border border-yellow-500/30 backdrop-blur-xl bg-[#1a0505]/60">
            <div className="text-center mb-8">
              <div className="flex justify-center items-center -space-x-4 mb-6">
                <div className="w-16 h-16 rounded-full border-2 border-yellow-500/50 shadow-xl overflow-hidden bg-white z-10">
                  <img src={rccgLogo} alt="RCCG" className="w-full h-full object-cover" />
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-yellow-500/50 shadow-xl overflow-hidden bg-white z-0">
                  <img src={faithLogo} alt="Faith Tribe" className="w-full h-full object-cover" />
                </div>
              </div>

              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                COORDINATOR <span className="text-yellow-500">PORTAL</span>
              </h1>
              <p className="text-red-200/60 text-sm mt-2 font-medium">
                Sign in with your Province ID
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-yellow-500/80 uppercase mb-2 tracking-wider">Province ID / Email</label>
                <div className="relative group">
                  <FaUser className="absolute left-4 top-3.5 text-red-400" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full pl-11 pr-4 py-3 bg-black/30 border border-red-900/50 rounded-xl text-white focus:ring-2 focus:ring-yellow-500/50 transition-all outline-none"
                    placeholder="e.g. lp9@faithtribe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-yellow-500/80 uppercase mb-2 tracking-wider">Password</label>
                <div className="relative group">
                  <FaLock className="absolute left-4 top-3.5 text-red-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-11 pr-12 py-3 bg-black/30 border border-red-900/50 rounded-xl text-white focus:ring-2 focus:ring-yellow-500/50 transition-all outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-red-400 hover:text-yellow-400"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full btn-primary py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? "Authenticating..." : "ACCESS DASHBOARD"}
              </motion.button>
            </form>
            
            <div className="mt-6 text-center border-t border-white/5 pt-4">
              <p className="text-xs text-red-300/40">
                Default Password: <span className="font-mono text-yellow-500/50">faithtribe2025</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default CoordinatorLogin;