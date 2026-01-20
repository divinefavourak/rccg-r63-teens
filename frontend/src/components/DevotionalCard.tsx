import { Link } from 'react-router-dom';
import { Devotional } from '../types';
import { FaBookOpen, FaHeart, FaCalendarAlt } from 'react-icons/fa';

interface DevotionalCardProps {
    devotional: Devotional;
}

const DevotionalCard = ({ devotional }: DevotionalCardProps) => {
    return (
        <Link
            to={`/devotional/${devotional.id}`}
            className="card group hover:scale-[1.02] transition-transform duration-300 flex flex-col h-full"
        >
            <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 relative overflow-hidden rounded-t-2xl">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute bottom-4 left-4 text-white">
                    <div className="flex items-center gap-2 text-primary-100 text-sm mb-1">
                        <FaCalendarAlt />
                        <span>{new Date(devotional.date).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl font-bold leading-tight line-clamp-2">{devotional.title}</h3>
                </div>
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white">
                    <FaBookOpen />
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                    <p className="text-xs text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider mb-2">
                        scripture
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 font-serif italic border-l-4 border-primary-200 pl-3">
                        {devotional.scripture_reference}
                    </p>
                </div>

                <div className="mt-auto flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>Read more →</span>
                    <div className="flex items-center gap-1">
                        <FaHeart className={devotional.is_liked ? "text-red-500" : "text-gray-300"} />
                        <span>{devotional.likes_count}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default DevotionalCard;
