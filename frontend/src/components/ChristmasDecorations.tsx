import { motion } from "framer-motion";

const ChristmasDecorations = () => {
  // Generate random stars
  const stars = Array.from({ length: 15 });
  // Generate lights for the wire
  const lights = Array.from({ length: 20 });
  // Generate random floating hats
  const hats = Array.from({ length: 6 });

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden="true">
      
      {/* 1. Hanging Lights Wire */}
      <div className="absolute top-0 left-0 w-full h-12 z-50 hidden md:block">
        <svg className="absolute top-0 left-0 w-full h-8 overflow-visible" preserveAspectRatio="none">
          <path d="M0,0 Q50,15 100,0 T200,0 T300,0 T400,0 T500,0 T600,0 T700,0 T800,0 T900,0 T1000,0 T1100,0 T1200,0 T1300,0 T1400,0 T1500,0 T1600,0" 
                fill="none" stroke="#555" strokeWidth="1" className="dark:stroke-gray-600" />
        </svg>
        <div className="flex justify-around absolute top-0 w-full">
          {lights.map((_, i) => (
            <div 
              key={i} 
              className={`w-3 h-3 rounded-full mt-1 animate-twinkle shadow-lg ${
                i % 3 === 0 ? 'bg-red-500 shadow-red-500/50' : 
                i % 3 === 1 ? 'bg-yellow-400 shadow-yellow-400/50' : 
                'bg-green-500 shadow-green-500/50'
              }`}
              style={{
                animationDelay: `${Math.random() * 2}s`,
                transform: `translateY(${Math.sin(i) * 5}px)`
              }}
            />
          ))}
        </div>
      </div>

      {/* 2. Floating Golden Stars */}
      {stars.map((_, i) => (
        <motion.div
          key={`star-${i}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 5
          }}
          className="absolute text-yellow-400 dark:text-yellow-200"
          style={{
            top: `${Math.random() * 80}%`,
            left: `${Math.random() * 100}%`,
            fontSize: `${Math.random() * 10 + 10}px`,
            filter: 'blur(0.5px)'
          }}
        >
          ✦
        </motion.div>
      ))}

      {/* 3. Drifting Santa Hats */}
      {hats.map((_, i) => (
        <motion.div
          key={`hat-${i}`}
          initial={{ y: -100, x: Math.random() * 100, opacity: 0, rotate: 0 }}
          animate={{ 
            y: window.innerHeight + 100, 
            x: Math.random() * 200 - 100, // Drift left/right
            opacity: [0, 0.8, 0],
            rotate: [0, 45, -45, 0]
          }}
          transition={{
            duration: 15 + Math.random() * 10,
            repeat: Infinity,
            delay: Math.random() * 20,
            ease: "linear"
          }}
          className="absolute z-0 opacity-50"
          style={{ left: `${Math.random() * 100}%` }}
        >
          <span className="text-4xl filter drop-shadow-lg">🎅</span>
        </motion.div>
      ))}

      {/* 4. Hanging Ornaments (Corners) */}
      <div className="absolute top-0 left-10 animate-swing origin-top z-50 hidden lg:block">
        <div className="w-[2px] h-24 bg-yellow-600/50 mx-auto"></div>
        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-900 rounded-full shadow-xl border border-yellow-500/30 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border border-yellow-400/20"></div>
        </div>
      </div>

      <div className="absolute top-0 right-10 animate-swing origin-top z-50 hidden lg:block" style={{ animationDelay: '1s' }}>
        <div className="w-[2px] h-32 bg-yellow-600/50 mx-auto"></div>
        <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-full shadow-xl border border-white/20 flex items-center justify-center">
           <span className="text-2xl">✨</span>
        </div>
      </div>

      {/* 5. Bottom Scene: Trees & Snowman */}
      <div className="absolute bottom-0 left-0 w-full h-auto z-10 flex items-end justify-between px-4 pointer-events-none opacity-40 dark:opacity-60">
        
        {/* Forest Layer (Left) */}
        <div className="flex items-end -mb-2 space-x-[-20px]">
          <span className="text-6xl animate-wave origin-bottom" style={{ animationDelay: '0s' }}>🎄</span>
          <span className="text-4xl animate-wave origin-bottom" style={{ animationDelay: '1.5s' }}>🎄</span>
          <span className="text-7xl animate-wave origin-bottom" style={{ animationDelay: '0.5s' }}>🎄</span>
        </div>

        {/* Waving Snowman (Right) */}
        <div className="relative animate-float -mb-4 mr-4">
           {/* Snowman Body */}
           <div className="flex flex-col items-center">
              <span className="text-8xl filter drop-shadow-2xl">⛄</span>
           </div>
        </div>
      </div>

    </div>
  );
};

export default ChristmasDecorations;