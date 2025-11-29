import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Countdown from "../components/Countdown";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { EVENT_DETAILS, CAMP_FEATURES } from "../constants/eventDetails";
import { FaPray, FaGamepad, FaTheaterMasks, FaUsers } from "react-icons/fa";
import { IconType } from "react-icons";

// --- Snow Effect Component ---

const LandingPage = () => {
  const stats = [
    { number: "500+", label: "Children Expected" },
    { number: "3", label: "Days of Glory" },
    { number: "22-25", label: "December" },
    { number: "∞", label: "Blessings" },
  ];

  const featureIcons: IconType[] = [
    FaPray, FaGamepad, FaTheaterMasks, FaUsers
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white overflow-x-hidden relative transition-colors duration-500">
      <Navbar />
      
      {/* Hero Section */}
      <section className="min-h-screen relative flex items-center justify-center px-6 pt-20 overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-red-50 dark:bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] dark:from-red-900/50 dark:via-[#1a0505] dark:to-[#0f0202] transition-all duration-500"></div>
        
        {/* Curtains (Dark Mode Only) */}
        <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-black/80 to-transparent z-0 opacity-0 dark:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/80 to-transparent z-0 opacity-0 dark:opacity-100 transition-opacity duration-500"></div>
        


        {/* Hero Content */}
        <div className="relative z-10 text-center max-w-6xl mx-auto">
          {/* Logo / Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-4 inline-block"
          >
            <div className="flex items-center justify-center space-x-3 bg-white/80 dark:bg-black/30 backdrop-blur-sm px-6 py-2 rounded-full border border-yellow-500/30 shadow-sm">
              <span className="text-yellow-600 dark:text-yellow-400 font-bold tracking-widest text-sm uppercase">RCCG Region 63 Junior Church</span>
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="mb-6 relative"
          >
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black leading-[0.9] tracking-tighter">
              <span className="block text-gold-3d drop-shadow-xl font-['Impact'] tracking-wide">
                THE PRICELESS
              </span>
              <span className="block text-8xl md:text-[10rem] text-gold-3d mt-2">
                GIFT
              </span>
            </h1>
          </motion.div>

          {/* Scripture Tag */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <span className="text-xl md:text-2xl font-bold text-white bg-red-600 dark:bg-red-800/80 px-6 py-2 rounded-lg shadow-lg border-2 border-yellow-500/50">
              2 CORINTHIANS 9:15
            </span>
          </motion.div>

          {/* Location & Date Card */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-12 inline-block relative group"
          >
            <div className="absolute inset-0 bg-yellow-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-white text-red-900 p-1 rounded-2xl rotate-1 transform transition-transform hover:rotate-0 shadow-xl">
              <div className="border-2 border-dashed border-red-900/30 rounded-xl p-6 bg-snow-pattern">
                <h3 className="text-2xl font-black uppercase mb-1 text-red-900">@ Glory Arena, Redemption City</h3>
                <p className="font-semibold text-red-800">KM 46, Lagos-Ibadan Expressway, Ogun State</p>
                <div className="mt-3 flex items-center justify-center space-x-2 text-lg font-bold bg-red-900 text-yellow-400 py-2 px-4 rounded-lg">
                  <span>📅 22nd - 25th DEC</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center relative z-20"
          >
            <Link to="/get-ticket" className="btn-primary flex items-center gap-2">
              <span>🎁 REGISTER FOR FREE</span>
            </Link>
            <button className="btn-secondary">
              LEARN MORE
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white dark:bg-red-950 border-y border-yellow-500/20 relative transition-colors duration-500">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-black text-yellow-500 dark:text-yellow-400 mb-2 drop-shadow-sm">
                  {stat.number}
                </div>
                <div className="text-red-900 dark:text-red-100 font-medium uppercase tracking-widest text-xs md:text-sm font-bold">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-red-50 dark:bg-[#1a0505] transition-colors duration-500">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-red-900 dark:text-white">
              <span className="text-gold-3d">UNWRAP</span> THE EXPERIENCE
            </h2>
            <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full"></div>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {CAMP_FEATURES.map((feature, index) => {
              const IconComponent = featureIcons[index];
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -10 }}
                  className="bg-white dark:bg-red-900/20 border border-red-100 dark:border-red-500/20 p-8 rounded-2xl text-center group hover:shadow-xl dark:hover:bg-red-900/40 transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform">
                    <IconComponent className="text-2xl text-red-900" />
                  </div>
                  <h3 className="text-xl font-bold text-red-900 dark:text-yellow-100 mb-4">{feature.title}</h3>
                  <ul className="space-y-2">
                    {feature.items.map((item) => (
                      <li key={item} className="text-sm text-gray-600 dark:text-red-100/70">{item}</li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Countdown Section */}
      <section className="py-24 relative overflow-hidden bg-green-900 dark:bg-transparent">
        {/* Light Mode: Green Background / Dark Mode: Transparent over global gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-800 to-green-950 opacity-100 dark:opacity-0 transition-opacity duration-500"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10"></div>
        
        <div className="relative z-10 container-custom text-center">
          <motion.div
            initial={{ scale: 0.9 }}
            whileInView={{ scale: 1 }}
            className="inline-block mb-8"
          >
            <span className="bg-red-600 text-white px-4 py-1 rounded-full text-sm font-bold tracking-wide uppercase shadow-lg">
              Don't Miss Out
            </span>
          </motion.div>
          
          <h2 className="text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-lg">
            THE CAMP OPENS IN
          </h2>
          
          <div className="mb-12">
            <Countdown />
          </div>
          
          <Link to="/get-ticket" className="btn-primary text-xl px-16 py-6 inline-block shadow-2xl hover:shadow-yellow-500/50">
            SECURE YOUR SEAT
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;