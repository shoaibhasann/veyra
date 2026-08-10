import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/sections/Hero";
import IntroSection from "@/components/sections/IntroSection";
import YardSection from "@/components/sections/YardSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import CarriersSection from "@/components/sections/CarriersSection";
import InsightsSection from "@/components/sections/InsightsSection";
import CtaSection from "@/components/sections/CtaSection";
import PartnersSection from "@/components/sections/PartnersSection";
import FaqSection from "@/components/sections/FaqSection";

export default function Home() {
  return (
    <SmoothScroll>
      <Nav />
      <main>
        {/* Section order is also ScrollTrigger creation order, which is what keeps
            the pins honest. ONE pin runs on this page — YardSection's ~12-viewport
            yard narrative — so its pin-spacer is inserted before anything
            downstream of it measures. */}
        <Hero />
        {/* The hero is position-sticky (z-0) and stays stuck behind the page
            for the rest of <main>. Everything after it rides in this one
            positioned z-10 layer so even the non-positioned sections
            (Testimonials, Partners, FAQ) paint above the stuck hero. A plain
            relative wrapper adds no layout, no transform and no containing
            block for fixed elements, so both pins measure and pin exactly as
            before. */}
        <div className="relative z-10">
          <IntroSection />
          <YardSection />
          {/* The air act's hand-off: the freighter brakes onto its mark as
              the pin releases, and daylight — the testimonial section, the
              same airframe parked on its right edge — scrolls in beneath. */}
          <TestimonialsSection />
          {/* The carrier board follows the clients, on the same paper. */}
          <CarriersSection />
          {/* The carrier board's paper runs into the reversed arc and the
              page turns over to night for the wire. */}
          <PartnersSection />
          {/* The paper run ends here: the reversed arc turns the page to
              night for the wire, and it stays night until the FAQ. */}
          <InsightsSection />
          <FaqSection />
          <CtaSection />
        </div>
      </main>
      <Footer />
    </SmoothScroll>
  );
}
