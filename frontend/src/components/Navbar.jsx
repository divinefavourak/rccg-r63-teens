import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Register", path: "/get-ticket" },
    { name: "Admin", path: "/admin" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 w-full glass-effect z-50 shadow-2xl"
    >
      <div className="container mx-auto px-6 py-3"> {/* Reduced padding */}
        <div className="flex justify-between items-center">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
              R63
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-sm leading-tight">RCCG REGION 63</div>
              <div className="text-yellow-300 text-xs leading-tight">JUNIOR CHURCH</div>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`relative px-3 py-2 font-bold transition-all duration-300 text-sm ${
                  location.pathname === item.path
                    ? "text-yellow-400"
                    : "text-white hover:text-yellow-300"
                }`}
              >
                {item.name}
                {location.pathname === item.path && (
                  <motion.div
                    layoutId="navbar-underline"
                    className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full"
                  />
                )}
              </Link>
            ))}
            <Link
              to="/get-ticket"
              className="btn-primary text-xs py-2 px-4 text-gray-900"
            >
              🎟️ REGISTER
            </Link>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className={`w-5 h-0.5 bg-yellow-400 mb-1 transition-transform ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
            <div className={`w-5 h-0.5 bg-yellow-400 mb-1 transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`}></div>
            <div className={`w-5 h-0.5 bg-yellow-400 transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="md:hidden mt-3 p-4 glass-effect rounded-xl shadow-2xl border border-white/20"
          >
            <div className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`block px-3 py-2 rounded-lg font-bold transition-all text-sm ${
                    location.pathname === item.path
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"
                      : "text-white hover:bg-white/10"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;