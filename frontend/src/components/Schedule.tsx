import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { CAMP_SCHEDULE } from "../constants/eventDetails";
import { FaCalendarDay, FaChevronDown, FaClock } from "react-icons/fa";

const Schedule = () => {
  const [activeDay, setActiveDay] = useState<number | null>(0); // Default open Day 1

  return (
    <div className="max-w-4xl mx-auto px-4">
      {CAMP_SCHEDULE.map((day, index) => (
        <div key={day.date} className="mb-6">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setActiveDay(activeDay === index ? null : index)}
            className={`w-full flex items-center justify-between p-6 rounded-2xl transition-all duration-300 border backdrop-blur-sm ${activeDay === index
                ? "bg-gradient-to-r from-red-900/90 to-red-800/90 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                : "bg-white/10 dark:bg-black/40 border-white/10 hover:border-yellow-500/50 hover:bg-white/15"
              }`}
            aria-expanded={activeDay === index}
            aria-controls={`schedule-content-${index}`}
          >
            <div className="flex items-center gap-5">
              <div
                className={`p-4 rounded-xl shadow-inner ${activeDay === index
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-black/20 text-gray-400"
                  }`}
              >
                <FaCalendarDay className="text-xl" />
              </div>
              <div className="text-left">
                <div className="flex items-baseline gap-3">
                  <h4
                    className={`font-black text-xl tracking-wider uppercase ${activeDay === index ? "text-white" : "text-gray-200"
                      }`}
                  >
                    {day.day}
                  </h4>
                  <span className="text-sm font-semibold text-yellow-500/80 uppercase tracking-widest">
                    {day.date}
                  </span>
                </div>
                <p
                  className={`text-sm font-medium mt-1 ${activeDay === index ? "text-yellow-100/80" : "text-gray-400"
                    }`}
                >
                  {day.theme}
                </p>
              </div>
            </div>
            <div
              className={`p-2 rounded-full transition-transform duration-300 ${activeDay === index
                  ? "rotate-180 bg-white/10 text-white"
                  : "text-gray-500"
                }`}
            >
              <FaChevronDown />
            </div>
          </motion.button>

          <AnimatePresence>
            {activeDay === index && (
              <motion.div
                id={`schedule-content-${index}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-4 px-6 py-8 bg-black/20 dark:bg-black/40 backdrop-blur-md rounded-b-2xl border-x border-b border-white/5 relative">
                  {/* Vertical Timeline Line */}
                  <div className="absolute left-[2.85rem] top-8 bottom-8 w-px bg-gradient-to-b from-yellow-500/50 via-yellow-500/20 to-transparent"></div>

                  <div className="space-y-8 relative">
                    {day.events.map((event, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex group relative"
                      >
                        {/* Timeline Node */}
                        <div className="absolute left-[1.35rem] mt-1.5 w-3 h-3 rounded-full border-2 border-yellow-500/50 bg-black group-hover:bg-yellow-500 group-hover:scale-125 transition-all duration-300 z-10 shadow-[0_0_10px_rgba(255,215,0,0.2)]"></div>

                        <div className="flex-1 ml-16 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-yellow-500/30 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <h5 className="font-bold text-gray-100 text-lg tracking-wide group-hover:text-yellow-400 transition-colors">
                              {event.activity}
                            </h5>
                            <div className="flex items-center gap-2 text-xs font-mono text-yellow-600/80 bg-yellow-500/10 px-3 py-1 rounded-full w-fit">
                              <FaClock />
                              {event.time}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export default Schedule;