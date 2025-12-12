import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FaInstagram, FaTimes, FaExpand } from "react-icons/fa";
import mj from "../assets/mummyJ.JPG";
import img1 from "../assets/img1.JPG";
import img2 from "../assets/img2_replacement.jpg";
import img3 from "../assets/img3.JPG";
import img4 from "../assets/img4.JPG";
import img5 from "../assets/img5.JPG";

const photos = [
  { src: mj, style: "md:col-span-2 md:row-span-2 h-96", position: "object-top" },
  { src: img2, style: "md:col-span-1 md:row-span-1 h-48", position: "object-top" },
  { src: img3, style: "md:col-span-1 md:row-span-1 h-48" },
  { src: img4, style: "md:col-span-1 md:row-span-1 h-48" },
  { src: img5, style: "md:col-span-1 md:row-span-1 h-48" },
  { src: img1, style: "md:col-span-1 md:row-span-1 h-48" }
];

const PhotoGallery = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="container-custom py-20 px-4">
      <div className="flex flex-col items-center mb-12">
        <h3 className="text-3xl font-black text-red-900 dark:text-white uppercase flex items-center gap-3 tracking-tighter">
          <FaInstagram className="text-pink-600 text-4xl" /> #RCCGTeensR63
        </h3>
        <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 tracking-wide uppercase text-sm">Capture the priceless moments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {photos.map((photo, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            className={`relative rounded-3xl overflow-hidden shadow-2xl group cursor-pointer border-4 border-white/20 dark:border-white/5 ${photo.style}`}
            onClick={() => setSelectedImage(photo.src)}
          >
            <img
              src={photo.src}
              alt={`Camp Highlight ${index + 1}`}
              className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${photo.position || 'object-center'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-6">
              <span className="text-white font-bold text-sm tracking-widest uppercase">View Photo</span>
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white">
                <FaExpand />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-center mt-16">
        <motion.a
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-full font-bold shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all font-mono text-sm uppercase tracking-wider"
        >
          <FaInstagram className="text-xl" />
          View Full Gallery
        </motion.a>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 z-10 p-3 bg-black/50 hover:bg-red-600 text-white rounded-full transition-colors backdrop-blur-md"
                onClick={() => setSelectedImage(null)}
              >
                <FaTimes className="text-xl" />
              </button>
              <img
                src={selectedImage}
                alt="Full View"
                className="w-full h-full object-contain max-h-[90vh]"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoGallery;