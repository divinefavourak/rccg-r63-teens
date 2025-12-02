import { motion } from "framer-motion";
import { FaLock, FaGift } from "react-icons/fa";

const AdventCalendar = () => {
  // Generate 22 days
  const days = Array.from({ length: 22 }, (_, i) => ({
    day: i + 1,
    title: i === 0 ? "Theme Reveal" : i === 21 ? "Grand Finale" : `Day ${i + 1} Surprise`,
    locked: i > 2 // Simulate only first 3 days unlocked for demo
  }));

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <h3 className="text-2xl font-black text-red-900 dark:text-white uppercase">22 Days of Glory</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Counting down with daily reveals</p>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-w-6xl mx-auto px-4">
        {days.map((item, index) => (
          <motion.div
            key={item.day}
            whileHover={{ y: -5 }}
            className={`aspect-square rounded-xl flex flex-col items-center justify-center p-2 relative overflow-hidden cursor-pointer border transition-colors ${
              item.locked 
                ? "bg-gray-200 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-400" 
                : "bg-red-600 text-white border-red-500 shadow-lg shadow-red-500/20"
            }`}
          >
            {item.locked ? (
              <>
                <span className="text-xs font-bold mb-1">DEC</span>
                <span className="text-2xl font-black opacity-50">{item.day}</span>
                <FaLock className="absolute bottom-2 right-2 text-xs opacity-50" />
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-tighter">OPEN</span>
                <span className="text-2xl font-black">{item.day}</span>
                <FaGift className="absolute top-2 right-2 text-yellow-400 text-xs animate-bounce" />
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdventCalendar;