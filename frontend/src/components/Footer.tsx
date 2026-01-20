import { motion } from "framer-motion";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { Mail, Phone, User, ArrowUp } from "lucide-react";
import rccgLogo from "../assets/logo.jpg";
import faithLogo from "../assets/faith_logo.jpg";

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 py-16 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden transition-colors duration-500"
    >
      {/* Decorative gradient line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"></div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-3 gap-12">

          {/* Brand Section */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex -space-x-3 hover:space-x-1 transition-all">
                <img src={rccgLogo} alt="RCCG" className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-md z-10" />
                <img src={faithLogo} alt="Faith Tribe" className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-md z-0" />
              </div>
              <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white uppercase">FAITH TRIBE</span>
            </div>

            <p className="text-sm leading-relaxed mb-6">
              RCCG Region 63 Junior Church. Nurturing the next generation in Christ through impactful programs and the priceless gift of salvation.
            </p>
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Contact Information</h4>
            <div className="space-y-4 text-sm">
              <p className="flex items-center gap-3 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Mail size={16} />
                </span>
                {EVENT_DETAILS.contact.email}
              </p>
              <p className="flex items-center gap-3 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Phone size={16} />
                </span>
                {EVENT_DETAILS.contact.phone}
              </p>
              <p className="flex items-center gap-3 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User size={16} />
                </span>
                {EVENT_DETAILS.contact.pastor}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Quick Links</h4>
            <div className="space-y-3 text-sm">
              <FooterLink href="/register" label="Sign Up" />
              <FooterLink href="/login" label="Login" />
              <FooterLink href="/admin-login" label="Admin Portal" />
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-xs flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2025 RCCG Region 63 Junior Church | Faith Tribe. All rights reserved.</p>
          <p className="font-bold text-primary-600 dark:text-primary-400 tracking-wider uppercase text-[10px]">The Priceless Gift</p>

          <button
            onClick={scrollToTop}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 text-gray-500 dark:text-gray-400 hover:text-primary-600 p-2 rounded-full transition-all hover:-translate-y-1 shadow-sm"
            aria-label="Scroll to top"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </motion.footer>
  );
};

const FooterLink = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors hover:translate-x-1 duration-200"
  >
    {label}
  </a>
);

export default Footer;