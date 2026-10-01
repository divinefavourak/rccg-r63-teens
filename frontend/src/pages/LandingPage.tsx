import Seo from "../components/Seo";
import MotionRoot, { ScrollProgress } from "../components/site/MotionRoot";
import SiteFooter from "../components/site/SiteFooter";
import SiteNav from "../components/site/SiteNav";
import Community from "./landing/Community";
import Features from "./landing/Features";
import Hero from "./landing/Hero";
import Install from "./landing/Install";
import Leaders from "./landing/Leaders";
import Marquee from "./landing/Marquee";
import Showcase from "./landing/Showcase";

/**
 * The website's front page, built from the Figma frames "Landing · Desktop"
 * (81:1386) and "Landing · Mobile" (110:5573).
 *
 * It brings its own nav and footer and is routed outside PublicLayout, whose
 * Navbar and Footer belong to the older pages. The root sets its own surface
 * and text colours rather than inheriting them, so the app's `dark` class has
 * no effect here: the design has a light mode only so far.
 *
 * Layout and copy follow Figma. The motion is not in the file. It was asked for
 * separately, and its vocabulary lives in components/site/motion.ts.
 */
const LandingPage = () => (
  <MotionRoot>
    <div className="min-h-screen bg-surface-base font-sans text-content-primary antialiased">
      <Seo
        title="Faith Tribe"
        description="A few minutes with God, every day. One short reading, one verse to keep, and the whole Bible, made for teens across RCCG Region 63."
        path="/"
      />
      <ScrollProgress />
      <SiteNav />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Showcase />
        <Community />
        <Install />
        <Leaders />
      </main>
      <SiteFooter />
    </div>
  </MotionRoot>
);

export default LandingPage;
