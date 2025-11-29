import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { FaSun, FaMoon } from "react-icons/fa";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";

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
      className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/90 dark:bg-[#2b0303]/95 backdrop-blur-md border-b border-red-100 dark:border-yellow-500/20 shadow-xl"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Dual Logo Section - Updated for Size & Spacing */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 md:gap-4"
          >
            {/* Logos Container - Removed overlap, increased size */}
            <div className="flex items-center gap-2">
              <img 
                src={rccgLogo} 
                alt="RCCG Logo" 
                className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-yellow-500/50 shadow-md object-cover hover:scale-110 transition-transform duration-300"
              />
              <img 
                src={faithLogo} 
                alt="Faith Tribe Logo" 
                className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-yellow-500/50 shadow-md object-cover hover:scale-110 transition-transform duration-300"
              />
            </div>
            
            {/* Divider (Optional, adds separation) */}
            <div className="hidden sm:block w-px h-10 bg-yellow-500/30"></div>

            <Link to="/" className="text-left flex flex-col justify-center">
              <div className="text-red-900 dark:text-white font-black text-sm md:text-base leading-none tracking-wide font-['Impact'] mb-1">
                RCCG REGION 63
              </div>
              <div className="text-yellow-600 dark:text-yellow-400 text-[10px] md:text-xs leading-none font-bold tracking-widest uppercase">
                Junior Church | Faith Tribe
              </div>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
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
            
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-red-100 dark:bg-black/20 text-red-800 dark:text-yellow-400 hover:scale-110 transition-transform shadow-sm"
            >
              {theme === 'dark' ? <FaSun size={16} /> : <FaMoon size={16} />}
            </button>

            <Link
              to="/get-ticket"
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-red-900 text-xs font-black py-2.5 px-6 rounded-full shadow-lg hover:shadow-yellow-500/50 transition-all transform hover:-translate-y-0.5"
            >
              REGISTER NOW
            </Link>
          </div>

          {/* Mobile Menu Controls */}
          <div className="flex items-center gap-3 md:hidden">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-red-50 dark:bg-white/10 text-red-800 dark:text-yellow-400 border border-red-100 dark:border-white/10"
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

        {/* Mobile Menu Dropdown */}
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