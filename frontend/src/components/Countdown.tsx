import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, memo } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// 1. Move TimeUnit OUTSIDE so it doesn't re-create on every tick
const TimeUnit = memo(({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center mx-2 md:mx-4">
    <div className="relative group">
      {/* Binder Rings */}
      <div className="absolute -top-2 left-1/4 w-2 h-5 bg-gradient-to-b from-gray-300 to-gray-500 rounded-full z-20 shadow-sm border border-gray-400"></div>
      <div className="absolute -top-2 right-1/4 w-2 h-5 bg-gradient-to-b from-gray-300 to-gray-500 rounded-full z-20 shadow-sm border border-gray-400"></div>

      {/* Main Card */}
      <div className="relative w-20 h-24 md:w-28 md:h-32 bg-white dark:bg-[#1a0505] rounded-lg overflow-hidden shadow-[0_4px_6px_rgba(0,0,0,0.3)] border-b-4 border-r-2 border-gray-300 dark:border-red-900/50 flex flex-col">
        
        {/* Header */}
        <div className="h-8 bg-red-700 dark:bg-red-900 flex items-center justify-center z-10 shadow-sm">
          <span className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest">
            {label}
          </span>
        </div>

        {/* Number Display */}
        <div className="flex-1 relative flex items-center justify-center bg-gray-50 dark:bg-[#0f0202]">
          {/* Split Line */}
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gray-200 dark:bg-white/10 z-0"></div>

          <AnimatePresence mode="popLayout">
            <motion.span
              key={value} // Only changes when number changes
              initial={{ y: "-100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={{ 
                duration: 0.3,
                ease: "backOut" 
              }}
              className="text-4xl md:text-6xl font-black font-mono text-gray-800 dark:text-yellow-400 z-10 block absolute"
            >
              {value.toString().padStart(2, "0")}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  </div>
));

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // Target Date: Dec 22, 2025
    const campDate = new Date("2025-12-22T00:00:00").getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = campDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-wrap justify-center items-center py-8">
      <TimeUnit value={timeLeft.days} label="DAYS" />
      <TimeUnit value={timeLeft.hours} label="HOURS" />
      <TimeUnit value={timeLeft.minutes} label="MINS" />
      <TimeUnit value={timeLeft.seconds} label="SECS" />
    </div>
  );
};

export default Countdown;