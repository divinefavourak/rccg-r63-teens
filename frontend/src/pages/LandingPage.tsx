import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import Countdown from "../components/Countdown";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Schedule from "../components/Schedule";
import FAQ from "../components/FAQ";
import PhotoGallery from "../components/PhotoGallery"; // NEW
import AdventCalendar from "../components/AdventCalendar"; // NEW
import { CAMP_FEATURES, PACKING_LIST, EVENT_DETAILS } from "../constants/eventDetails";
import { generatePDF } from "../utils/pdfGenerator";
import {
  FaPray, FaGamepad, FaTheaterMasks, FaUsers,
  FaInfoCircle, FaUser, FaUserTie,
  FaWhatsapp, FaTwitter, FaQuoteLeft, FaMapMarkerAlt, FaFilePdf, FaCheck,
  FaInstagram, FaFacebookF
} from "react-icons/fa";
import { IconType } from "react-icons";
import toast from "react-hot-toast";

const SHARE_TEXT = `Register for ${EVENT_DETAILS.theme} Camp 2025! Don't miss this life-changing experience. Join us at ${EVENT_DETAILS.location}. Register now: https://r63teens.com`;

const LandingPage = () => {
  const navigate = useNavigate();
  const [ticketId, setTicketId] = useState("");

  const handleCheckStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) {
      navigate(`/ticket-preview?ticket_id=${ticketId.trim()}`);
    }
  };

  const stats = [
    { number: "500+", label: "Children Expected" },
    { number: "3", label: "Days of Glory" },
    { number: "22-25", label: "December" },
    { number: "∞", label: "Blessings" },
  ];

  const featureIcons: IconType[] = [
    FaPray, FaGamepad, FaTheaterMasks, FaUsers
  ];

  const testimonials = [
    {
      id: 1,
      name: "Emmanuel O.",
      province: "Lagos Province 9",
      quote: "The best Christmas I ever had! I made so many friends and the sports were amazing.",
    },
    {
      id: 2,
      name: "Sarah A.",
      province: "Lagos Province 28",
      quote: "The worship sessions changed my life. I truly found the priceless gift. Can't wait for 2025!",
    }
  ];

  const shareText = encodeURIComponent("Join me at The Priceless Gift Camp 2025! 🎁 Dec 22-25 @ Redemption City. Register now! #PricelessGift2025");

  const handleDownloadPackingList = () => {
    generatePDF('packing-list-content', 'RCCG-Camp-Packing-List.pdf');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#2b0303] text-gray-800 dark:text-white overflow-x-hidden relative transition-colors duration-500">
      <Navbar />

      {/* Hero Section */}
      <section className="min-h-screen relative flex items-center justify-center px-6 pt-20 overflow-hidden" aria-label="Hero Section">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517090504586-fde19ea6066f?q=80&w=2070&auto=format&fit=crop"
            alt="Teens gathered around a bonfire celebrating"
            className="w-full h-full object-cover animate-pulse-slow"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/80 via-[#2b0303]/80 to-[#0f0202] mix-blend-multiply"></div>
        </div>

        <div className="relative z-10 text-center max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-4 inline-block"
          >
            <div className="flex items-center justify-center space-x-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-yellow-500/50 shadow-lg">
              <span className="text-yellow-400 font-bold tracking-widest text-sm uppercase text-shadow-sm">RCCG Region 63 Junior Church</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="mb-6 relative"
          >
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black leading-[0.9] tracking-tighter drop-shadow-2xl">
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 font-['Impact'] tracking-wide">
                THE PRICELESS
              </span>
              <span className="block text-8xl md:text-[10rem] text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 mt-2">
                GIFT
              </span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <span className="text-xl md:text-2xl font-bold text-white bg-red-700/90 px-8 py-3 rounded-lg shadow-xl border border-yellow-500/50 backdrop-blur-sm">
              2 CORINTHIANS 9:15
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-8 max-w-2xl mx-auto"
          >
            <div className="bg-green-900/60 border border-green-500/50 p-4 rounded-xl flex items-start gap-3 text-left shadow-2xl backdrop-blur-md">
              <FaInfoCircle className="text-yellow-400 text-xl mt-1 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-bold text-yellow-400 uppercase text-sm tracking-wider mb-1">
                  Registration Now Open
                </h2>
                <p className="text-white/90 text-sm leading-relaxed">
                  <strong>Individual & Coordinator registration is live!</strong> Secure your spot for the camp.
                  Registration fee: <span className="font-bold text-yellow-300 text-lg">₦3,000</span>.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-col md:flex-row gap-6 justify-center items-center relative z-20 mt-12"
          >
            <Link to="/get-ticket" className="group relative w-full md:w-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-red-600 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center gap-4 bg-black/80 border border-yellow-500/50 px-8 py-5 rounded-xl hover:scale-105 transition-transform shadow-2xl">
                <div className="bg-yellow-600/20 p-3 rounded-full text-yellow-400">
                  <FaUser className="text-2xl" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">For Individuals</p>
                  <p className="text-xl font-black text-white whitespace-nowrap">Register Yourself</p>
                </div>
              </div>
            </Link>

            <Link to="/coordinator-login" className="group relative w-full md:w-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center gap-4 bg-black/80 border border-blue-500/50 px-8 py-5 rounded-xl hover:scale-105 transition-transform shadow-2xl">
                <div className="bg-blue-600/20 p-3 rounded-full text-blue-400">
                  <FaUserTie className="text-2xl" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">For Coordinators</p>
                  <p className="text-xl font-black text-white whitespace-nowrap">Bulk Portal</p>
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-10 relative z-20 max-w-md mx-auto"
          >
            <p className="text-white/60 text-xs uppercase font-bold tracking-widest mb-2">Already Registered?</p>
            <form onSubmit={handleCheckStatus} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Ticket ID to Check Status"
                className="w-full px-5 py-3 rounded-xl border border-white/20 bg-white/5 text-white placeholder-white/40 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all text-center md:text-left"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
              />
              <button
                type="submit"
                className="bg-yellow-500 text-red-900 font-bold px-6 py-3 rounded-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-yellow-500/20 whitespace-nowrap"
              >
                CHECK STATUS
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Countdown Section */}
      <section className="py-24 relative overflow-hidden bg-green-950" aria-label="Countdown Timer">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10"></div>
        <div className="relative z-10 container-custom text-center">
          <motion.div
            initial={{ scale: 0.9 }}
            whileInView={{ scale: 1 }}
            className="inline-block mb-8"
          >
            <span className="bg-red-600 text-white px-6 py-2 rounded-full text-sm font-bold tracking-wide uppercase shadow-lg animate-pulse">
              Time is Ticking
            </span>
          </motion.div>

          <h2 className="text-4xl md:text-6xl font-black mb-12 text-white drop-shadow-lg">
            THE CAMP OPENS IN
          </h2>

          <div className="mb-12 scale-110 md:scale-125 transform transition-transform">
            <Countdown />
          </div>

          <div className="flex flex-col items-center gap-4 mt-16">
            <p className="text-yellow-400 font-bold uppercase tracking-widest text-sm">Tell a friend</p>
            <div className="flex gap-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white p-4 rounded-full hover:bg-green-500 hover:scale-110 transition-all shadow-lg"
                title="Share on WhatsApp"
                aria-label="Share on WhatsApp"
              >
                <FaWhatsapp className="text-2xl" aria-hidden="true" />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black text-white p-4 rounded-full hover:bg-gray-900 hover:scale-110 transition-all shadow-lg border border-white/20"
                title="Share on X"
                aria-label="Share on X"
              >
                <FaTwitter className="text-2xl" aria-hidden="true" />
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(SHARE_TEXT);
                  toast.success("Link copied! Paste it on Instagram.");
                }}
                className="bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white p-4 rounded-full hover:scale-110 transition-all shadow-lg cursor-pointer"
                title="Copy Link for Instagram"
                aria-label="Share on Instagram"
              >
                <FaInstagram className="text-2xl" aria-hidden="true" />
              </button>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://r63teens.com")}&quote=${encodeURIComponent(SHARE_TEXT)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white p-4 rounded-full hover:bg-blue-500 hover:scale-110 transition-all shadow-lg"
                title="Share on Facebook"
                aria-label="Share on Facebook"
              >
                <FaFacebookF className="text-2xl" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section >

      {/* NEW: Advent Calendar Teaser */}
      < section className="bg-white dark:bg-[#2b0303] transition-colors duration-500" >
        <AdventCalendar />
      </section >

      {/* Schedule Section */}
      < section className="section-padding bg-gray-50 dark:bg-[#1a0505] transition-colors duration-500" >
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-red-900 dark:text-white uppercase mb-4">Camp Schedule</h2>
            <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full"></div>
          </motion.div>
          <Schedule />
        </div>
      </section >

      {/* Features Section */}
      < section className="section-padding bg-red-50 dark:bg-[#2b0303] transition-colors duration-500" >
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
                  className="bg-white dark:bg-white/5 border border-red-100 dark:border-white/10 p-8 rounded-2xl text-center group hover:shadow-xl transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform">
                    <IconComponent className="text-2xl text-red-900" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-red-900 dark:text-yellow-100 mb-4">{feature.title}</h3>
                  <ul className="space-y-2">
                    {feature.items.map((item) => (
                      <li key={item} className="text-sm text-gray-600 dark:text-gray-300">{item}</li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section >

      {/* NEW: Photo Gallery */}
      < section className="bg-white dark:bg-[#1a0505] transition-colors duration-500" >
        <PhotoGallery />
      </section >

      {/* Packing List Section */}
      < section className="py-20 bg-yellow-50 dark:bg-yellow-900/10 border-y border-yellow-500/20" >
        <div className="container-custom px-6">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-left md:pl-10">
              <h2 className="text-3xl md:text-4xl font-black text-red-900 dark:text-white uppercase mb-6">
                Ready to Camp?
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
                Don't forget the essentials! We've prepared a checklist to ensure you have everything you need for a comfortable stay at Redemption City.
              </p>
              <button
                onClick={handleDownloadPackingList}
                className="btn-primary px-8 py-4 flex items-center gap-3 shadow-xl"
              >
                <FaFilePdf className="text-xl" /> <span>DOWNLOAD PACKING LIST</span>
              </button>
            </div>

            <div id="packing-list-content" className="flex-1 bg-white dark:bg-black/40 p-8 rounded-3xl border-2 border-dashed border-gray-300 dark:border-white/20 w-full max-w-md mx-auto">
              <h3 className="text-xl font-bold text-gray-900 dark:text-yellow-400 mb-6 flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-4">
                <FaCheck className="text-green-500" /> What to Bring
              </h3>
              <ul className="space-y-3">
                {PACKING_LIST.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-white/30 flex items-center justify-center shrink-0">
                      <div className="w-2.5 h-2.5 bg-transparent rounded-full"></div>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">RCCG Region 63 Teens</p>
              </div>
            </div>
          </div>
        </div>
      </section >

      {/* Testimonials Section */}
      < section className="py-20 bg-white dark:bg-[#2b0303] border-t border-yellow-500/10" >
        <div className="container-custom">
          <h2 className="text-3xl font-black text-center mb-12 text-red-900 dark:text-white uppercase">Voices from 2024</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((t) => (
              <motion.div
                key={t.id}
                whileHover={{ scale: 1.02 }}
                className="p-8 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/10 relative shadow-sm"
              >
                <FaQuoteLeft className="text-4xl text-yellow-500/20 absolute top-4 left-4" aria-hidden="true" />
                <p className="text-gray-600 dark:text-gray-300 italic mb-4 relative z-10 font-medium">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center text-white font-bold shadow">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-red-900 dark:text-white leading-tight">{t.name}</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 uppercase font-bold">{t.province}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section >

      {/* FAQ Section */}
      < section className="section-padding bg-gray-50 dark:bg-[#1a0505]" >
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-black text-red-900 dark:text-white uppercase mb-4">Frequently Asked Questions</h2>
            <div className="w-24 h-1 bg-yellow-500 mx-auto rounded-full"></div>
          </motion.div>
          <FAQ />
        </div>
      </section >

      {/* Location Map Section */}
      < section className="py-12 bg-white dark:bg-[#2b0303] border-t border-gray-200 dark:border-white/5" >
        <div className="container-custom">
          <div className="bg-white dark:bg-white/5 p-4 rounded-3xl shadow-xl border border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2 mb-4 px-2">
              <FaMapMarkerAlt className="text-red-600 dark:text-yellow-500" aria-hidden="true" />
              <h3 className="font-bold text-gray-900 dark:text-white">Glory Arena, Redemption City</h3>
            </div>
            <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden grayscale hover:grayscale-0 transition-all duration-500">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d253546.83191702416!2d3.167940886718751!3d6.810026100000021!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103bc109f4c889d1%3A0xb1f3f83ca8b39cbe!2sGlory%20Arena!5e0!3m2!1sen!2sng!4v1764637960258!5m2!1sen!2sng"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Map to Redemption City"
              ></iframe>
            </div>
          </div>
        </div>
      </section >

      <Footer />
    </div >
  );
};

export default LandingPage;