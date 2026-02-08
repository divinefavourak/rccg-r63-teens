import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { BookOpen, PlayCircle, Calendar, Users, ArrowRight, CheckCircle, Star } from "lucide-react";
import HeroCarousel from "../components/HeroCarousel";
import Footer from "../components/Footer";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors font-sans text-gray-900 dark:text-white">
      <Navbar />

      {/* Hero Section - Split Layout */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Text Content */}
            <div className="flex-1 text-center lg:text-left z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-bold text-sm mb-8 animate-fade-in-up">
                <Star size={16} className="fill-current" />
                <span>The Official Faith Tribe Platform</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.1]">
                Grow in Faith, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-green-400">
                  Together in Christ.
                </span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Join a vibrant community of teenagers devoted to God. Access daily devotionals, study manuals, inspiring media, and exclusive events.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="btn-primary px-8 py-4 text-base font-bold shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                  Join the Tribe <ArrowRight size={20} />
                </Link>
                <Link
                  to="/devotionals"
                  className="px-8 py-4 rounded-xl font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                >
                  <BookOpen size={20} className="text-primary-500" /> Start Reading
                </Link>
              </div>

              <div className="mt-12 flex items-center justify-center lg:justify-start gap-8 text-sm font-bold text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" /> <span>Free Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" /> <span>Daily Content</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" /> <span>Community</span>
                </div>
              </div>
            </div>

            {/* Hero Image / Graphic */}
            <div className="flex-1 relative w-full h-[500px] lg:h-auto min-h-[400px]">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-gray-50 dark:bg-gray-800/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white mb-6">Everything You Need to Grow</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">Access powerful resources designed specifically for teens to strengthen their walk with Christ.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<BookOpen size={24} />}
              title="Daily Devotionals"
              desc="Start your day with inspiring messages tailored for teens."
              link="/devotionals"
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            />
            <FeatureCard
              icon={<Users size={24} />}
              title="Study Manuals"
              desc="Access weekly study guides and resources for group discussions."
              link="/manuals"
              color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            />
            <FeatureCard
              icon={<PlayCircle size={24} />}
              title="Media Library"
              desc="Watch sermons, listen to podcasts, and relive event highlights."
              link="/media"
              color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            />
            <FeatureCard
              icon={<Calendar size={24} />}
              title="Events & Activities"
              desc="Stay connected with upcoming camps, conferences, and meetups."
              link="/events"
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="bg-primary-900 rounded-[2.5rem] p-12 lg:p-24 relative overflow-hidden text-center shadow-2xl">
            {/* Abstract Background - Replaced Image */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-6xl font-black text-white mb-8 tracking-tight">Ready to go deeper?</h2>
              <p className="text-primary-100 mb-10 text-xl leading-relaxed">Create an account to track your devotional streak, save your favorite messages, and register for exclusive events.</p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register" className="inline-flex items-center justify-center bg-white text-primary-900 font-black px-10 py-4 rounded-xl hover:bg-gray-50 transition-all hover:scale-105 shadow-xl">
                  Get Started <ArrowRight size={20} className="ml-2" />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center bg-primary-800 text-white font-bold px-10 py-4 rounded-xl border border-primary-700 hover:bg-primary-700 transition-all">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const FeatureCard = ({ icon, title, desc, link, color }: { icon: any, title: string, desc: string, link: string, color: string }) => (
  <Link
    to={link}
    className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800 group hover:-translate-y-1 block h-full"
  >
    <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110`}>
      {icon}
    </div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
    <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed text-sm">
      {desc}
    </p>
  </Link>
);

export default LandingPage;