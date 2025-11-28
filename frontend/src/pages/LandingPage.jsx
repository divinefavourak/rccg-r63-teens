import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Countdown from "../components/Countdown";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS, CAMP_FEATURES } from "../constants/eventDetails";
import { FaPray, FaBible, FaGamepad, FaTheaterMasks, FaUsers, FaStar, FaMusic, FaFilm } from "react-icons/fa";
import { GiPartyPopper } from "react-icons/gi";

const LandingPage = () => {
  const stats = [
    { number: "500+", label: "Children Expected" },
    { number: "3", label: "Amazing Days" },
    { number: "20+", label: "Activities" },
    { number: "∞", label: "Divine Memories" },
  ];

  const featureIcons = [
    FaPray,    // Spiritual Growth
    FaGamepad, // Fun & Games  
    FaTheaterMasks, // Creative Arts
    FaUsers    // Community
  ];

  return (
    <div className="min-h-screen bg-gradient-primary text-white overflow-hidden">
      <Navbar />
      
      {/* Hero Section - Added mt-20 for spacing */}
      <section className="min-h-screen relative flex items-center justify-center px-6 pt-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 text-center max-w-6xl mx-auto">
          {/* Church Branding */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="text-lg md:text-xl font-semibold text-yellow-300 mb-2 tracking-wide">
              {EVENT_DETAILS.subtitle}
            </div>
            <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-600 mx-auto mb-4 rounded-full"></div>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-6xl md:text-8xl font-black mb-6 leading-tight tracking-tight"
          >
            <span className="text-gradient">{EVENT_DETAILS.theme}</span>
          </motion.h1>

          {/* Scripture */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mb-8"
          >
            <div className="text-xl md:text-2xl font-light italic text-yellow-200 mb-6">
              "{EVENT_DETAILS.scripture}"
            </div>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">
              {EVENT_DETAILS.tagline}
            </p>
          </motion.div>

          {/* Location & Date */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mb-12"
          >
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 inline-block">
              <div className="text-lg font-semibold text-yellow-300 mb-2">
                {EVENT_DETAILS.location}
              </div>
              <div className="text-white/90 mb-2">
                {EVENT_DETAILS.address}
              </div>
              <div className="text-xl font-bold text-white">
                {EVENT_DETAILS.date}
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mb-12"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
              {EVENT_DETAILS.features.slice(0, 5).map((feature, index) => (
                <div key={feature} className="glass-effect rounded-lg p-3 text-center">
                  <div className="text-sm font-medium text-white">{feature}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-4">
              {EVENT_DETAILS.features.slice(5).map((feature, index) => (
                <div key={feature} className="glass-effect rounded-lg p-3 text-center">
                  <div className="text-sm font-medium text-white">{feature}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <Link to="/get-ticket" className="btn-primary text-lg px-12 py-5 text-gray-900">
              🎟️ REGISTER NOW
            </Link>
            <button className="glass-effect hover:bg-white/20 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 border border-yellow-400/30">
              LEARN MORE ↓
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="animate-bounce">
            <div className="w-6 h-10 border-2 border-yellow-400 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-yellow-400 rounded-full mt-2"></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="section-padding bg-gradient-to-br from-blue-800/50 to-purple-800/50">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-black text-gradient mb-2">
                  {stat.number}
                </div>
                <div className="text-yellow-200 font-semibold">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-gradient-to-br from-purple-900/80 to-blue-900/80">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-black mb-6 text-white">
              WHAT'S <span className="text-gradient">INCLUDED</span>
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              An unforgettable experience designed for spiritual growth and amazing fun
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {CAMP_FEATURES.map((feature, index) => {
              const IconComponent = featureIcons[index];
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="card p-8 text-center group cursor-pointer"
                >
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <IconComponent className="text-3xl text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black mb-6 text-gray-800 group-hover:text-gradient transition-colors">
                    {feature.title}
                  </h3>
                  <ul className="space-y-3 text-left">
                    {feature.items.map((item, itemIndex) => (
                      <motion.li
                        key={item}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: itemIndex * 0.1 }}
                        className="flex items-center space-x-3 text-gray-700"
                      >
                        <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm">{item}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Countdown Section */}
      <section className="section-padding bg-gradient-to-br from-yellow-500 to-yellow-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 container-custom text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-6xl font-black mb-6 text-gray-900"
          >
            COUNTDOWN <span className="text-white">BEGINS!</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-xl mb-12 max-w-2xl mx-auto text-gray-800 font-semibold"
          >
            Don't miss out on this life-changing experience. Register before time runs out!
          </motion.p>
          
          <Countdown />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12"
          >
            <Link to="/get-ticket" className="btn-secondary text-lg px-12 py-5">
              🚀 SECURE YOUR SPOT NOW
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;