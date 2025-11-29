import { motion } from "framer-motion";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { FaEnvelope, FaPhone, FaUser, FaChurch } from "react-icons/fa";

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="bg-red-900 dark:bg-[#1a0505] text-white py-12 border-t border-yellow-500/20 relative overflow-hidden transition-colors duration-500"

    >
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-yellow-600 to-transparent"></div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-2xl font-black mb-4 flex items-center text-yellow-400 font-['Impact'] tracking-wide">
              <FaChurch className="mr-2" />
              RCCG Region 63 Teens
            </h3>
            <p className="text-red-100/80 mb-4 leading-relaxed">
              Nurturing the next generation in Christ through impactful programs and the priceless gift of salvation.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-bold mb-4 text-white border-b-2 border-yellow-600 inline-block pb-1">Contact Information</h4>
            <div className="space-y-3 text-red-100/80">
              <p className="flex items-center hover:text-yellow-400 transition-colors">
                <FaEnvelope className="mr-3 text-yellow-500" />
                {EVENT_DETAILS.contact.email}
              </p>
              <p className="flex items-center hover:text-yellow-400 transition-colors">
                <FaPhone className="mr-3 text-yellow-500" />
                {EVENT_DETAILS.contact.phone}
              </p>
              <p className="flex items-center hover:text-yellow-400 transition-colors">
                <FaUser className="mr-3 text-yellow-500" />
                {EVENT_DETAILS.contact.pastor}
              </p>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-bold mb-4 text-white border-b-2 border-yellow-600 inline-block pb-1">Quick Links</h4>
            <div className="space-y-2">
              <a href="/get-ticket" className="block text-red-100/80 hover:text-yellow-400 transition-colors">
                Register for Event
              </a>
              <a href="/#features" className="block text-red-100/80 hover:text-yellow-400 transition-colors">
                Event Features
              </a>
              <a href="/admin" className="block text-red-100/80 hover:text-yellow-400 transition-colors">
                Admin Portal
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-red-200/60">
          © 2025 RCCG Region 63 Junior Church - THE PRICELESS. All rights reserved. | 
          <span className="text-yellow-500/80 ml-1">Designed for Glory</span>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;