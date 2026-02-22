
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar';
import Footer from '../Footer';

const PublicLayout = () => {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0a0202] text-gray-900 dark:text-white transition-colors duration-500">
            <Navbar />
            <main className="flex-grow pt-[72px]"> {/* pt-[72px] to account for fixed navbar height */}
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default PublicLayout;
