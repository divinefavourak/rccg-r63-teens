import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import img1 from '../assets/img1.JPG';
import logo from '../assets/faith_tribe_logo.png'; // Assuming this exists, or fallback

interface AuthLayoutProps {
    children: ReactNode;
    title?: string;
    subtitle?: string;
}

const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
    return (
        <div className="min-h-screen w-full flex bg-[#1f2029]">
            {/* Left Side - Decorative */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{ backgroundImage: `url(${img1})` }}
                />
                <div className="absolute inset-0 bg-[#1f2029]/40 backdrop-blur-[2px] z-10" />

                <div className="relative z-20 flex flex-col justify-between p-12 w-full text-white">
                    <div>
                        <img src={logo} alt="Faith Tribe Logo" className="h-16 w-auto mb-8" />
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-5xl font-bold leading-tight mb-4 font-['Poppins']"
                        >
                            {title || "Welcome to Divine Teens"}
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-xl text-gray-200"
                        >
                            {subtitle || "Join us for an amazing experience."}
                        </motion.p>
                    </div>

                    <div className="text-sm text-gray-300">
                        © {new Date().getFullYear()} RCCG R63 Teens. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative">
                {/* Mobile Logo */}
                <div className="lg:hidden absolute top-8 left-8">
                    <img src={logo} alt="Logo" className="h-12 w-auto" />
                </div>

                <div className="w-full max-w-[500px]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
