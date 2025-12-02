import { motion } from "framer-motion";
import { FaInstagram } from "react-icons/fa";
import mj from "../assets/mummyJ.JPG";
import img1 from "../assets/img1.jpg";
import img2 from "../assets/img2.jpg";
import img3 from "../assets/img3.jpg";
import img4 from "../assets/img4.jpg";
import img5 from "../assets/img5.jpg";

// You can mix local imports and remote URLs
const photos = [
  mj,
  img2,
  img3,
  img4,
  img5,
  img1
];

const PhotoGallery = () => {
  return (
    <div className="container-custom py-12">
      <div className="flex flex-col items-center mb-10">
        <h3 className="text-2xl font-black text-red-900 dark:text-white uppercase flex items-center gap-2">
          <FaInstagram className="text-pink-600" /> #RCCGTeensR63
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Capture the priceless moments</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((src, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.03 }}
            className={`relative rounded-xl overflow-hidden shadow-lg group ${index === 0 ? 'row-span-2 col-span-2' : 'h-48 md:h-64'}`}
          >
            <img 
              src={src} 
              alt={`Camp Highlight ${index + 1}`} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <FaInstagram className="text-white text-3xl drop-shadow-lg" />
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="text-center mt-8">
        <a 
          href="https://instagram.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm font-bold text-blue-600 dark:text-yellow-400 hover:underline"
        >
          View Full Gallery on Instagram →
        </a>
      </div>
    </div>
  );
};

export default PhotoGallery;