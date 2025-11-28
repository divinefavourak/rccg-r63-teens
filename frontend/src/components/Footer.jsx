import { motion } from "framer-motion";
import { EVENT_DETAILS } from "../constants/eventDetails";
import { FaEnvelope, FaPhone, FaUser, FaChurch } from "react-icons/fa";

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="bg-gray-900 text-white py-12"
    >
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 flex items-center">
              <FaChurch className="mr-2 text-yellow-400" />
              RCCG Region 63 Teens
            </h3>
            <p className="text-gray-400 mb-4">
              Nurturing the next generation in Christ through impactful programs and events.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Information</h4>
            <div className="space-y-3 text-gray-400">
              <p className="flex items-center">
                <FaEnvelope className="mr-2 text-yellow-400" />
                {EVENT_DETAILS.contact.email}
              </p>
              <p className="flex items-center">
                <FaPhone className="mr-2 text-yellow-400" />
                {EVENT_DETAILS.contact.phone}
              </p>
              <p className="flex items-center">
                <FaUser className="mr-2 text-yellow-400" />
                {EVENT_DETAILS.contact.pastor}
              </p>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <div className="space-y-2">
              <a href="/get-ticket" className="block text-gray-400 hover:text-yellow-400 transition-colors">
                Register for Event
              </a>
              <a href="#details" className="block text-gray-400 hover:text-yellow-400 transition-colors">
                Event Details
              </a>
              <a href="/admin" className="block text-gray-400 hover:text-yellow-400 transition-colors">
                Admin Login
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm text-gray-500">
          © 2025 RCCG Region 63 Junior Church - THE PRICELESS. All rights reserved. | 
          Designed with ❤️ for the next generation
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;