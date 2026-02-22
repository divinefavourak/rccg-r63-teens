
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Book, FileText } from 'lucide-react';
import { Manual, mockContentService } from '../../services/mockContentService';

const Manuals = () => {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchManuals = async () => {
            try {
                const data = await mockContentService.getManuals();
                setManuals(data);
            } catch (error) {
                console.error('Failed to fetch manuals', error);
            } finally {
                setLoading(false);
            }
        };

        fetchManuals();
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { scale: 0.9, opacity: 0 },
        show: { scale: 1, opacity: 1 }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading resources...</div>;

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white font-['Impact'] tracking-wide mb-2">Manuals & Resources</h1>
                <p className="text-gray-600 dark:text-gray-400">Equip yourself with knowledge (Daniel 11:32b).</p>
            </header>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {manuals.map((manual) => (
                    <motion.div
                        variants={item}
                        key={manual.id}
                        className="group bg-white dark:bg-[#1a0505] rounded-2xl overflow-hidden border border-gray-100 dark:border-yellow-500/10 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                        <div className="h-48 overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-end p-6">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${manual.category === 'Teacher' ? 'bg-red-600' : 'bg-blue-600'}`}>
                                    {manual.category}
                                </span>
                            </div>
                            <img
                                src={manual.coverImage}
                                alt={manual.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                        </div>
                        <div className="p-6">
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2 line-clamp-1">{manual.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2">
                                {manual.description}
                            </p>
                            <div className="flex gap-3">
                                <button className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-white py-2.5 rounded-xl font-medium transition-colors text-sm">
                                    <Book size={16} /> Read
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 bg-red-50 dark:bg-yellow-500/10 hover:bg-red-100 dark:hover:bg-yellow-500/20 text-red-700 dark:text-yellow-500 py-2.5 rounded-xl font-medium transition-colors text-sm">
                                    <Download size={16} /> PDF
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default Manuals;
