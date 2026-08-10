"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

let instance: Lenis | null = null;

/** The live Lenis instance, or null when smooth scroll is off (reduced motion / SSR). */
export function getLenis(): Lenis | null {
  return instance;
}

type SmoothScrollProps = {
  children?: React.ReactNode;
  /** Seconds Lenis takes to catch up to the target scroll position. */
  duration?: number;
  /** Set false to skip the `a[href^="#"]` interception. */
  anchors?: boolean;
};

export default function SmoothScroll({
  children,
  duration = 1.1,
  anchors = true,
}: SmoothScrollProps) {
  useEffect(() => {
    // Webfonts change every headline's metrics, which moves the start/end of
    // every pinned section. Mis-measured pins are the classic failure here, so
    // one authoritative refresh happens once the fonts have actually landed.
    let cancelled = false;
    const refreshAfterFonts = () => {
      const run = () => {
        if (!cancelled) ScrollTrigger.refresh();
      };
      if (document.fonts) {
        document.fonts.ready.then(run).catch(run);
      } else {
        run();
      }
    };

    // Native scrolling is the correct behaviour for reduced-motion users; the
    // page still works, ScrollTrigger just reads the real scroll position.
    if (prefersReducedMotion()) {
      refreshAfterFonts();
      return () => {
        cancelled = true;
      };
    }

    const lenis = new Lenis({
      duration,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
      autoRaf: false,
    });
    instance = lenis;

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    // gsap.ticker drives Lenis so both run on a single rAF loop, in order.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      if (!anchor || anchor.hasAttribute("data-lenis-ignore")) return;

      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;

      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.2 });
    };

    if (anchors) document.addEventListener("click", onAnchorClick);

    // Layout is only trustworthy after the first paint; late-loading fonts and
    // media shift trigger positions, so refresh again on fonts-ready and load.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    refreshAfterFonts();
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("load", onLoad);
      if (anchors) document.removeEventListener("click", onAnchorClick);
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      instance = null;
    };
  }, [duration, anchors]);

  return <>{children}</>;
}
