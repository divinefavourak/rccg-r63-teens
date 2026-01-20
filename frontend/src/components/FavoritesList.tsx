import { useEffect, useState } from 'react';
import api from '../api/axios';
import { FavoriteItem } from '../types';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaPlay, FaBookOpen, FaTrash } from 'react-icons/fa';

const FavoritesList = () => {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFavorites();
    }, []);

    const fetchFavorites = async () => {
        try {
            const { data } = await api.get('/profiles/favorites/');
            setFavorites(data);
        } catch (error) {
            console.error("Error fetching favorites", error);
            // toast.error("Failed to load favorites");
        } finally {
            setLoading(false);
        }
    };

    const removeFavorite = async (id: string) => {
        try {
            await api.delete(`/profiles/favorites/remove/`, { data: { id } }); // Adjust endpoint/method based on backend
            setFavorites(favorites.filter(f => f.id !== id));
            toast.success("Removed from favorites");
        } catch (error) {
            toast.error("Failed to remove");
        }
    };

    if (loading) return <div className="text-center py-4">Loading favorites...</div>;
    if (favorites.length === 0) return <div className="text-center py-4 text-gray-500">No favorites yet.</div>;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map((item) => {
                // Safe check for content object, backend might return it slightly differently
                const content = item.content_object || {};
                const isDevotional = item.content_type === 'devotional';
                const title = (content as any).title || "Unknown Title";
                const link = isDevotional ? `/devotional/${content.id}` : `/media/${content.id}`;

                return (
                    <div key={item.id} className="card p-4 flex items-start justify-between group">
                        <Link to={link} className="flex-1">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isDevotional ? 'bg-primary-500' : 'bg-accent'}`}>
                                    {isDevotional ? <FaBookOpen size={14} /> : <FaPlay size={14} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-500 transition-colors line-clamp-1">
                                        {title}
                                    </h3>
                                    <p className="text-xs text-gray-500 capitalize">{item.content_type.replace('_', ' ')}</p>
                                </div>
                            </div>
                        </Link>
                        <button
                            onClick={() => removeFavorite(item.id)}
                            className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        >
                            <FaTrash size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default FavoritesList;
