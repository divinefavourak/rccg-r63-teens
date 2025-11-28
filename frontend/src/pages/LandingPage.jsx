import { motion } from 'framer-motion';

const LandingPage = () => {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-gradient-to-b from-green-200 to-white">
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-5xl font-extrabold"
        >
          RCCG Campout 2025
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-lg max-w-xl"
        >
          Join us for an unforgettable spiritual experience filled with worship, fun, bonding, and God’s presence.
        </motion.p>

        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition"
          onClick={() => (window.location.href = "/get-ticket")}
        >
          Get Your Ticket Now
        </motion.button>
      </section>
  
        {/* Brief Info Section */}
        <section className="py-20 px-6 bg-gray-50 text-center">
          <h2 className="text-3xl font-semibold mb-4">What to Expect</h2>
          <p className="max-w-2xl mx-auto text-gray-700">
            Worship • Games • Workshops • Competitions • Night Sessions • Life-changing encounters.
          </p>
        </section>
  
        {/* Countdown */}
        <section className="py-20 px-6 text-center">
          <h2 className="text-3xl font-semibold mb-6">Countdown to Camp</h2>
          <div className="flex justify-center">
            <p className="text-5xl font-bold">Coming Soon</p>
          </div>
        </section>
  
        {/* Footer */}
        <footer className="py-8 text-center bg-gray-100 text-sm text-gray-500">
          RCCG Region 63 Teens • Campout 2025
        </footer>
      </main>
    );
  };
  
  export default LandingPage;
  