import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { FaLock, FaGift, FaStar, FaTimes, FaBible } from "react-icons/fa";
import { ADVENT_DAYS } from "../constants/eventDetails";

const AdventCalendar = () => {
  // Use system date for real logic, but for this demo we assume "today" is Dec 12th as requested
  // const today = new Date().getDate(); 
  // const currentMonth = new Date().getMonth(); // 0-11, Dec is 11

  // Hardcoded to 12 as per user instruction "Since today is 12th"
  const currentDay = 12;

  const [selectedDay, setSelectedDay] = useState<typeof ADVENT_DAYS[0] | null>(null);

  return (
    <div className="py-24 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-500 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-red-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="container-custom relative z-10 px-4">
        <div className="text-center mb-16">
          <motion.h3
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 uppercase mb-4 tracking-tighter drop-shadow-sm"
          >
            Journey to the Priceless Gift
          </motion.h3>
          <p className="text-gray-600 dark:text-gray-300 font-medium text-lg max-w-2xl mx-auto">
            A daily devotional countdown. Unlock a new verse each day as we journey together towards the <span className="text-yellow-600 font-bold">City of God</span>.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-11 gap-2 sm:gap-3 md:gap-4 max-w-7xl mx-auto">
          {ADVENT_DAYS.map((item) => {
            const isUnlocked = item.day <= currentDay;
            const isCampDay = item.isCampDay;
            const isToday = item.day === currentDay;

            return (
              <motion.div
                key={item.day}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: item.day * 0.03 }}
                viewport={{ once: true }}
                whileHover={isUnlocked ? { y: -5, scale: 1.05 } : {}}
                whileTap={isUnlocked ? { scale: 0.95 } : {}}
                onClick={() => isUnlocked && setSelectedDay(item)}
                className={`
                  aspect-[4/5] rounded-xl sm:rounded-2xl relative overflow-hidden cursor-pointer transition-all duration-500 flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 group shadow-xl
                  ${isUnlocked
                    ? isCampDay
                      ? "bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border-2 border-yellow-200"
                      : "bg-gradient-to-br from-red-600 to-red-800 border-2 border-red-500"
                    : isCampDay
                      ? "bg-gradient-to-br from-yellow-900/40 to-yellow-900/60 border-2 border-yellow-700/50 opacity-100" // Camp days locked
                      : "bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 opacity-70 grayscale"
                  }
                  ${isToday && "ring-2 sm:ring-4 ring-yellow-400 ring-offset-2 sm:ring-offset-4 ring-offset-white dark:ring-offset-black z-10"}
                `}
              >
                {/* Card Content */}
                <div className="relative z-10 flex flex-col items-center text-center w-full">
                  <span className={`text-[8px] sm:text-[10px] md:text-xs font-black uppercase tracking-widest mb-0.5 sm:mb-1 ${isUnlocked ? (isCampDay ? "text-red-900" : "text-yellow-400") : "text-gray-400"}`}>
                    DEC
                  </span>
                  <span className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black ${isUnlocked ? (isCampDay ? "text-red-950" : "text-white") : "text-gray-300"}`}>
                    {item.day}
                  </span>

                  {isUnlocked && (
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute -bottom-8 hidden sm:block">
                      <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md px-2 py-1 rounded-full text-white uppercase tracking-wider">
                        View
                      </span>
                    </div>
                  )}
                </div>

                {/* Icons - Relocated to Top Right */}
                {!isUnlocked && <FaLock className="absolute top-1 right-1 sm:top-2 sm:right-2 text-gray-500 text-[8px] sm:text-[10px]" />}
                {isUnlocked && !isCampDay && <FaGift className="absolute top-1 right-1 sm:top-2 sm:right-2 text-yellow-400 text-[10px] sm:text-xs animate-bounce" />}
                {isCampDay && <FaStar className={`absolute top-1 right-1 sm:top-2 sm:right-2 ${isUnlocked ? "text-red-600 animate-spin-slow" : "text-yellow-600/50"} text-[10px] sm:text-xs`} />}

                {/* Overlay for Camp Days */}
                {isCampDay && (
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50, rotateX: 10 }}
                animate={{ scale: 1, y: 0, rotateX: 0 }}
                exit={{ scale: 0.8, y: 50, rotateX: -10 }}
                onClick={(e) => e.stopPropagation()}
                className={`
                            relative w-full max-w-lg p-8 rounded-3xl shadow-2xl overflow-hidden
                            ${selectedDay.isCampDay
                    ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-red-900"
                    : "bg-gradient-to-br from-white to-gray-100 dark:from-red-950 dark:to-red-900 text-gray-800 dark:text-white"
                  }
                        `}
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedDay(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
                >
                  <FaTimes />
                </button>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black/10 mb-6">
                    {selectedDay.isCampDay ? <FaStar className="text-3xl text-red-800" /> : <FaBible className="text-3xl text-red-600 dark:text-yellow-500" />}
                  </div>

                  <h4 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-2">DECEMBER {selectedDay.day}</h4>
                  <h2 className="text-3xl font-black uppercase mb-6 leading-tight">{selectedDay.theme}</h2>

                  <div className="relative p-6 rounded-2xl bg-white/40 dark:bg-black/20 backdrop-blur-sm border border-white/20">
                    <FaGift className="absolute -top-3 -left-3 text-2xl text-yellow-500 rotate-12" />
                    <p className="text-xl font-serif italic leading-relaxed mb-4">
                      "{selectedDay.text}"
                    </p>
                    <p className="text-sm font-bold opacity-80 uppercase tracking-widest">— {selectedDay.verse}</p>
                  </div>

                  <div className="mt-8 text-xs font-bold opacity-60 uppercase tracking-widest flex flex-col gap-1">
                    <p>The Priceless Gift</p>
                    <p>Faith Tribe Camp Out 2025</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdventCalendar;