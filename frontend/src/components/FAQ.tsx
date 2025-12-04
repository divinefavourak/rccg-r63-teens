import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FAQ_ITEMS } from "../constants/eventDetails";
import { FaPlus, FaMinus } from "react-icons/fa";

const FAQ = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {FAQ_ITEMS.map((item, index) => (
        <div key={index} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-white/5">
          <button
            onClick={() => setActiveIndex(activeIndex === index ? null : index)}
            className="w-full flex justify-between items-center p-5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            aria-expanded={activeIndex === index}
          >
            <span className="font-bold text-gray-900 dark:text-white">{item.question}</span>
            <span className="text-yellow-600 dark:text-yellow-400">
              {activeIndex === index ? <FaMinus /> : <FaPlus />}
            </span>
          </button>
          
          <AnimatePresence>
            {activeIndex === index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="p-5 pt-0 text-gray-600 dark:text-gray-300 text-sm leading-relaxed border-t border-gray-100 dark:border-white/5">
                  {item.answer}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export default FAQ;