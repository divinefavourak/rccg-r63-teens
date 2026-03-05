import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";
import { Sun, Moon, Menu, X, ChevronRight, LogOut, LayoutDashboard, User } from "lucide-react";
import { cn } from "../lib/utils";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";
import { useAuthContext } from "../context/AuthContext";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuthContext();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Devotionals", path: "/devotionals" },
    { name: "Manuals", path: "/manuals" },
    { name: "Media", path: "/media" },
    { name: "Events", path: "/events" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-gray-200 dark:border-gray-800 shadow-sm py-3"
          : "bg-transparent border-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center -space-x-3 transition-transform group-hover:scale-105">
              <img
                src={rccgLogo}
                alt="RCCG Logo"
                className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm object-cover z-10"
              />
              <img
                src={faithLogo}
                alt="Faith Tribe Logo"
                className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-900 dark:text-white leading-none tracking-tight">
                RCCG REGION 63
              </span>
              <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold tracking-widest uppercase mt-0.5">
                Teens Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  location.pathname === item.path
                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                    : "text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )}
              >
                {item.name}
              </Link>
            ))}

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle Theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </button>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 ml-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                    <User size={13} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 max-w-[120px] truncate">
                    {user.username}
                  </span>
                </div>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm bg-primary-600 text-white hover:bg-primary-700 transition-all shadow-md shadow-primary-500/20 hover:scale-105 transform"
                >
                  <LayoutDashboard size={14} />
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  aria-label="Sign Out"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className={cn(
                  "ml-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-105 whitespace-nowrap",
                  "bg-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:bg-primary-700"
                )}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-900 dark:text-white"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
          >
            <div className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-all",
                    location.pathname === item.path
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                  {location.pathname === item.path && <ChevronRight size={16} />}
                </Link>
              ))}
              <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2">
                      <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center">
                        <User size={14} className="text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user.username}</span>
                    </div>
                    <Link
                      to="/dashboard"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-md"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <LayoutDashboard size={15} />
                      Dashboard
                    </Link>
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center justify-center w-full px-4 py-3 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-md"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Access Portal
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;