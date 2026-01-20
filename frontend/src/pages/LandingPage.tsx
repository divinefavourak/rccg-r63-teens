import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { BookOpen, PlayCircle, Calendar, Users, ArrowRight, CheckCircle, Star } from "lucide-react";
import { cn } from "../lib/utils";

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
                <span>The Official R63 Teens Platform</span>
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
            <div className="flex-1 relative w-full max-w-lg lg:max-w-none">
              <div className="relative aspect-square lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-800 transform rotate-2 hover:rotate-0 transition-all duration-500">
                {/* Fallback Pattern since Image Gen Failed */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-green-50 dark:from-primary-900/40 dark:to-gray-900">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:16px_16px]"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl text-primary-600">
                      <Star size={48} className="fill-current" />
                    </div>
                    <h3 className="text-2xl font-bold text-primary-900 dark:text-white mb-2">Welcome Home</h3>
                    <p className="text-primary-700 dark:text-primary-300">Your spiritual journey starts here.</p>
                  </div>
                </div>
              </div>

              {/* Floating Cards */}
              <div className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 animate-bounce-slow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Next Event</p>
                    <p className="font-bold text-gray-900 dark:text-white">Teens Camp '25</p>
                  </div>
                </div>
              </div>
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