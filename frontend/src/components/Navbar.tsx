import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTheme } from "../hooks/useTheme"; // Create this hook first!
import { FaSun, FaMoon } from "react-icons/fa";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Register", path: "/get-ticket" },
    { name: "Admin", path: "/admin" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/80 dark:bg-[#2b0303]/90 backdrop-blur-md border-b border-red-100 dark:border-yellow-500/20 shadow-lg"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-red-900 font-black text-sm border-2 border-yellow-200 shadow-md">
              R63
            </div>
            <Link to="/" className="text-left">
              <div className="text-red-900 dark:text-white font-bold text-sm leading-tight tracking-wide">RCCG REGION 63</div>
              <div className="text-yellow-600 dark:text-yellow-400 text-xs leading-tight font-medium">JUNIOR CHURCH</div>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`relative px-2 py-1 font-bold transition-all duration-300 text-sm tracking-wide ${
                  location.pathname === item.path
                    ? "text-red-600 dark:text-yellow-400"
                    : "text-gray-600 dark:text-red-100 hover:text-red-800 dark:hover:text-white"
                }`}
              >
                {item.name}
                {location.pathname === item.path && (
                  <motion.div
                    layoutId="navbar-underline"
                    className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 dark:bg-yellow-400 rounded-full"
                  />
                )}
              </Link>
            ))}
            
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-red-100 dark:bg-black/20 text-red-800 dark:text-yellow-400 hover:scale-110 transition-transform"
            >
              {theme === 'dark' ? <FaSun size={14} /> : <FaMoon size={14} />}
            </button>

            <Link
              to="/get-ticket"
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-red-900 text-xs font-black py-2 px-5 rounded-full shadow-lg hover:shadow-yellow-500/50 transition-all transform hover:-translate-y-0.5"
            >
              REGISTER
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-4 md:hidden">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-red-100 dark:bg-black/20 text-red-800 dark:text-yellow-400"
            >
              {theme === 'dark' ? <FaSun size={14} /> : <FaMoon size={14} />}
            </button>
            <button 
              className="p-2 text-red-800 dark:text-yellow-400"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className={`w-6 h-0.5 bg-current mb-1.5 transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
              <div className={`w-6 h-0.5 bg-current mb-1.5 transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`}></div>
              <div className={`w-6 h-0.5 bg-current transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 overflow-hidden bg-white/95 dark:bg-red-950/95 backdrop-blur-xl rounded-2xl border border-red-100 dark:border-yellow-500/20 shadow-xl"
            >
              <div className="p-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`block px-4 py-3 rounded-xl font-bold transition-all text-sm ${
                      location.pathname === item.path
                        ? "bg-red-50 dark:bg-yellow-500/20 text-red-600 dark:text-yellow-400"
                        : "text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default Navbar;