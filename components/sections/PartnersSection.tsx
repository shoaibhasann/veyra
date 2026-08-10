"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

const PARTNERS = [
  "Meridian Steelworks",
  "Kopu Agri",
  "Northbay Chemicals",
  "Sagara Textiles",
  "Orbit Electronics",
  "Halcyon Pharma",
  "Tanjung Minerals",
  "Vellore Automotive",
];

export default function PartnersSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reduce = prefersReducedMotion();
    if (reduce) return;

    const ctx = gsap.context(() => {
      // The track holds two identical runs, so -50% is exactly one seamless loop.
      tweenRef.current = gsap.to(track, {
        xPercent: -50,
        duration: 34,
        ease: "none",
        repeat: -1,
      });
    }, track);

    return () => {
      tweenRef.current = null;
      ctx.revert();
    };
  }, []);

  const setPaused = (paused: boolean) => {
    const tween = tweenRef.current;
    if (!tween) return;
    gsap.to(tween, { timeScale: paused ? 0 : 1, duration: 0.4, ease: "power2.out" });
  };

  return (
    <section id="partners" className="w-full overflow-hidden bg-paper py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
        <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-ink/45">
          <span aria-hidden className="h-px w-10 bg-signal" />
          (05) Moving freight for
        </p>
      </div>

      <div
        className="relative mt-10 md:mt-14"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {/* Edge fades so wordmarks dissolve rather than clip. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-paper to-transparent md:w-32"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-paper to-transparent md:w-32"
        />

        <div ref={trackRef} className="flex w-max items-center">
          {[0, 1].map((run) => (
            <ul
              key={run}
              aria-hidden={run === 1}
              className="flex shrink-0 items-center"
            >
              {PARTNERS.map((name) => (
                <li
                  key={`${run}-${name}`}
                  className="flex items-center gap-8 whitespace-nowrap px-8 md:gap-12 md:px-12"
                >
                  <span className="font-display text-lg font-bold uppercase tracking-[-0.01em] text-ink/40 transition-colors duration-300 hover:text-ink md:text-2xl">
                    {name}
                  </span>
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal/60" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
