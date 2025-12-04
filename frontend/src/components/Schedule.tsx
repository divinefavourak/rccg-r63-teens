import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { CAMP_SCHEDULE } from "../constants/eventDetails";
import { FaCalendarDay, FaClock, FaChevronDown } from "react-icons/fa";

const Schedule = () => {
  const [activeDay, setActiveDay] = useState<number | null>(0); // Default open Day 1

  return (
    <div className="max-w-4xl mx-auto">
      {CAMP_SCHEDULE.map((day, index) => (
        <div key={day.date} className="mb-4">
          <button
            onClick={() => setActiveDay(activeDay === index ? null : index)}
            className={`w-full flex items-center justify-between p-6 rounded-2xl transition-all duration-300 border-2 ${
              activeDay === index 
                ? "bg-red-900 text-yellow-400 border-yellow-500 shadow-lg" 
                : "bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-white/10 hover:border-yellow-500/50"
            }`}
            aria-expanded={activeDay === index}
            aria-controls={`schedule-content-${index}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${activeDay === index ? "bg-yellow-500/20 text-yellow-300" : "bg-gray-100 dark:bg-white/10"}`}>
                <FaCalendarDay />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-lg uppercase tracking-wide">{day.day} <span className="opacity-70 text-sm normal-case ml-2">• {day.date}</span></h4>
                <p className={`text-sm ${activeDay === index ? "text-yellow-200" : "text-gray-500 dark:text-gray-400"}`}>{day.theme}</p>
              </div>
            </div>
            <FaChevronDown className={`transition-transform duration-300 ${activeDay === index ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {activeDay === index && (
              <motion.div
                id={`schedule-content-${index}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-gray-50 dark:bg-black/20 rounded-b-2xl border-x-2 border-b-2 border-gray-200 dark:border-white/10 -mt-2 pt-6">
                  <div className="space-y-4">
                    {day.events.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-4 pb-4 border-b border-gray-200 dark:border-white/5 last:border-0 last:pb-0">
                        <div className="min-w-[80px] font-mono text-sm text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                          <FaClock className="text-xs" /> {event.time}
                        </div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">{event.activity}</div>
                      </div>
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