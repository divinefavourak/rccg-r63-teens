import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import img1 from '../assets/img1.JPG';
import img2 from '../assets/img2.JPG';
import img3 from '../assets/img3.JPG';
import img4 from '../assets/img4.JPG';
import img5 from '../assets/img5.JPG';

const images = [img1, img2, img3, img4, img5];

const HeroCarousel = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const nextSlide = () => {
        setActiveIndex((prev) => (prev + 1) % images.length);
    };

    const prevSlide = () => {
        setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Auto-play
    useEffect(() => {
        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, []);

    const getImageIndex = (offset: number) => {
        // Handling circular index
        return (activeIndex + offset + images.length) % images.length;
    };

    return (
        <div className="relative w-full h-[400px] md:h-[500px] flex items-center justify-center perspective-1000 overflow-hidden">

            {/* Cards Container */}
            <div className="relative w-full h-full flex items-center justify-center">
                {[-2, -1, 0, 1, 2].map((offset) => {
                    const index = getImageIndex(offset);
                    const image = images[index];

                    // Determine visual state based on offset
                    let zIndex = 0;
                    let scale = 0.6;
                    let opacity = 0;
                    let x = 0;
                    let rotateY = 0;

                    if (offset === 0) { // CENTER
                        zIndex = 20;
                        scale = 1.1;
                        opacity = 1;
                        x = 0;
                        rotateY = 0;
                    } else if (Math.abs(offset) === 1) { // ADJACENT
                        zIndex = 10;
                        scale = 0.85;
                        opacity = 0.7;
                        x = offset * 220; // Spread distance
                        rotateY = offset * -15; // Rotate inwards
                    } else if (Math.abs(offset) === 2) { // FAR
                        zIndex = 5;
                        scale = 0.7;
                        opacity = 0.4;
                        x = offset * 320; // Spread distance
                        rotateY = offset * -25;
                    }

                    // Adjust X for mobile check?
                    // For now hardcoded logic fits desktop well.

                    return (
                        <motion.div
                            key={`slide-${index}`} // Re-render if index changes position? No, optimize via layout?
                            // Ideally keys should track the Image itself, not the slot. 
                            // But for circular buffer, easiest is to just compute props.
                            className="absolute rounded-2xl shadow-2xl overflow-hidden border-4 border-white dark:border-gray-800 bg-gray-900"
                            initial={false}
                            animate={{
                                x,
                                scale,
                                opacity,
                                zIndex,
                                rotateY,
                            }}
                            transition={{
                                duration: 0.8,
                                ease: [0.16, 1, 0.3, 1], // Custom spring-like bezier
                            }}
                            style={{
                                width: '300px', // Base width
                                height: '400px', // Base height
                                transformStyle: 'preserve-3d',
                            }}
                            onClick={() => {
                                if (offset !== 0) {
                                    setActiveIndex(index);
                                }
                            }}
                        >
                            <img
                                src={image}
                                alt={`Slide ${index + 1}`}
                                className="w-full h-full object-cover pointer-events-none"
                            />
                            {/* Optional overlay for side images to darken them further */}
                            <div className={`absolute inset-0 bg-black transition-opacity duration-500 ${offset === 0 ? 'opacity-0' : 'opacity-40'}`} />
                        </motion.div>
                    );
                })}
            </div>

            {/* Navigation Buttons */}
            <button
                onClick={prevSlide}
                className="absolute left-4 md:left-10 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 transition-all hover:scale-110"
            >
                <ChevronLeft size={24} />
            </button>
            <button
                onClick={nextSlide}
                className="absolute right-4 md:right-10 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 transition-all hover:scale-110"
            >
                <ChevronRight size={24} />
            </button>

            {/* Indicators */}
            <div className="absolute bottom-4 z-30 flex gap-2">
                {images.map((_, i) => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-6 bg-primary-500' : 'bg-gray-500/50'}`}
                    />
                ))}
            </div>

        </div>
    );
};

export default HeroCarousel;
