import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const campDate = new Date("2025-08-15").getTime();

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
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const TimeUnit = ({ value, label }) => (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="text-center mx-2"
    >
      <div className="bg-white/20 backdrop-blur-lg rounded-xl p-4 min-w-[100px] border border-white/30 shadow-2xl">
        <motion.span
          key={value}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl md:text-5xl font-black text-white block font-mono"
        >
          {value.toString().padStart(2, "0")}
        </motion.span>
      </div>
      <span className="text-sm font-bold text-white mt-3 block tracking-wide">
        {label}
      </span>
    </motion.div>
  );

  return (
    <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
      <TimeUnit value={timeLeft.days} label="DAYS" />
      <div className="text-2xl text-white font-black">:</div>
      <TimeUnit value={timeLeft.hours} label="HOURS" />
      <div className="text-2xl text-white font-black">:</div>
      <TimeUnit value={timeLeft.minutes} label="MINUTES" />
      <div className="text-2xl text-white font-black">:</div>
      <TimeUnit value={timeLeft.seconds} label="SECONDS" />
    </div>
  );
};

export default Countdown;