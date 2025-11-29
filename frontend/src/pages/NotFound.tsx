import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-[#2b0303] text-white">
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-9xl mb-4"
        >
          ❄️
        </motion.div>
        <h1 className="text-6xl font-black text-yellow-500 mb-4">404</h1>
        <p className="text-2xl font-bold mb-8">Looks like you've wandered off the path!</p>
        <Link to="/" className="btn-primary px-8 py-3 rounded-xl">
          RETURN HOME
        </Link>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;