import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaUser, FaEye, FaEyeSlash, FaChurch } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    navigate('/admin', { replace: true });
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    toast.dismiss();

    try {
      const success = await login(formData.username, formData.password);
      if (success) {
        toast.success("Welcome back, Admin!");
        setTimeout(() => navigate('/admin', { replace: true }), 500);
      } else {
        toast.error("Access Denied. Check credentials.");
      }
    } catch {
      toast.error("System error. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a0505] relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-950 via-[#2b0303] to-black opacity-90"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-yellow-600/10 blur-[120px] rounded-full"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-effect rounded-2xl shadow-2xl p-8 border border-yellow-500/30">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(255,215,0,0.3)] border-4 border-red-900"
            >
              <FaChurch className="text-3xl text-red-900" />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-1 tracking-tight">
              ADMIN <span className="text-yellow-400">PORTAL</span>
            </h1>
            <p className="text-red-200/70 text-sm uppercase tracking-widest">
              RCCG Region 63 Junior Church
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-yellow-500 uppercase mb-2 tracking-wider">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaUser className="text-red-400 group-focus-within:text-yellow-400 transition-colors" />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-black/30 border border-red-900/50 rounded-xl text-white placeholder-red-900/50 focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all outline-none"
                  placeholder="Enter admin ID"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-yellow-500 uppercase mb-2 tracking-wider">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaLock className="text-red-400 group-focus-within:text-yellow-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-11 pr-12 py-3 bg-black/30 border border-red-900/50 rounded-xl text-white placeholder-red-900/50 focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-red-400 hover:text-yellow-400 transition-colors"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full btn-primary mt-4"
            >
              {isLoading ? "VERIFYING..." : "ENTER DASHBOARD"}
            </motion.button>
          </form>

          {/* Demo Hint */}
          <div className="mt-6 text-center">
            <p className="text-red-300/40 text-xs">
              Authorized Personnel Only • 2025
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;