import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { Sun, Moon, Menu, X, ChevronRight, LogOut, LayoutDashboard, User, Bell, BookOpen, Calendar, FileText } from "lucide-react";
import { cn } from "../lib/utils";
import { BRAND } from "../constants/brand";

const rccgLogo = BRAND.rccg;
const faithLogo = BRAND.faith;
import { useAuthContext } from "../context/AuthContext";
import api from "../api/axios";

interface UserNotif {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    icon: React.ReactNode;
    time: string;
}

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuthContext();
  const dashboardPath =
    (user as any)?.role === 'coordinator' ? '/coordinator/dashboard' :
    (user as any)?.role === 'admin' ? '/admin/dashboard' :
    '/dashboard';

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<UserNotif[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchUserNotifs = async () => {
    setNotifLoading(true);
    try {
      const [devotRes, manualRes, eventRes] = await Promise.all([
        api.get('/content/devotionals/?page_size=2&ordering=-date'),
        api.get('/content/manuals/?page_size=2&ordering=-week_start_date'),
        api.get('/events/events/?upcoming=true&page_size=2'),
      ]);

      const devots: UserNotif[] = (devotRes.data?.results ?? devotRes.data ?? []).map((d: any) => ({
        id: `dev-${d.id}`,
        title: d.title || 'New Devotional',
        subtitle: d.date ? `Open Heavens — ${new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Daily devotional',
        href: `/devotionals/${d.id}`,
        icon: <BookOpen size={13} className="text-amber-500" />,
        time: d.date || '',
      }));

      const manuals: UserNotif[] = (manualRes.data?.results ?? manualRes.data ?? []).map((m: any) => ({
        id: `man-${m.id}`,
        title: m.title || 'New Manual',
        subtitle: m.week_start_date ? `Week of ${new Date(m.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Weekly manual',
        href: `/manuals`,
        icon: <FileText size={13} className="text-primary-500" />,
        time: m.week_start_date || '',
      }));

      const events: UserNotif[] = (eventRes.data?.results ?? eventRes.data ?? []).map((ev: any) => ({
        id: `evt-${ev.id}`,
        title: ev.title || 'Upcoming Event',
        subtitle: ev.start_datetime ? new Date(ev.start_datetime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '',
        href: `/events/${ev.id}`,
        icon: <Calendar size={13} className="text-green-500" />,
        time: ev.start_datetime || '',
      }));

      setNotifs([...events, ...devots, ...manuals].slice(0, 6));
    } catch {
      // silently fail
    } finally {
      setNotifLoading(false);
    }
  };

  const handleNotifClick = (href: string) => {
    setNotifOpen(false);
    navigate(href);
  };

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
    <nav
      className={cn(
        "nav-slide-down fixed top-0 w-full z-50 transition-all duration-300 border-b",
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

            {isAuthenticated && user && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => { if (!notifOpen) fetchUserNotifs(); setNotifOpen(o => !o); }}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell size={19} />
                  {notifs.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-76 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden" style={{ width: '300px' }}>
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">What's New</p>
                      <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifLoading ? (
                        <div className="py-6 text-center text-xs text-gray-400">Loading...</div>
                      ) : notifs.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-400">Nothing new right now</div>
                      ) : notifs.map(n => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n.href)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0 text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                            {n.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 truncate">{n.subtitle}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  to={dashboardPath}
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

      {/*
        Mobile menu. Always mounted, expanded via the .collapsible grid-rows
        transition rather than AnimatePresence — the previous version needed
        framer-motion purely to animate height:"auto", and it was the only
        AnimatePresence on the critical path.
      */}
      <div
        className={cn(
          "collapsible md:hidden border-t bg-white dark:bg-gray-900 shadow-xl",
          isMenuOpen
            ? "is-open border-gray-100 dark:border-gray-800"
            : "border-transparent pointer-events-none"
        )}
        aria-hidden={!isMenuOpen}
      >
        <div>
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
                      to={dashboardPath}
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
        </div>
      </div>
    </nav>
  );
};

export default Navbar;