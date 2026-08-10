"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { curtainOpening } from "@/lib/curtain";
import { addWipeTo, prepareWipe } from "@/lib/wipe";

/**
 * THE FIRST TWO SECONDS. Night, the wordmark arriving under its own
 * brand-blue wipe, and a radar pulse going out from it — then the whole
 * plate irises away and the hero plays its reveal into a page the reader is
 * already looking at.
 *
 * Mounted once per full page load (not per route change), skipped entirely
 * under reduced motion, and gated on the webfont: the wordmark is the one
 * thing on screen, so it may not arrive in a fallback face and reflow.
 */
const RINGS = [0, 0.42, 0.84];

export default function Loader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const mark = markRef.current;
    if (!root || !mark) return;

    if (prefersReducedMotion()) {
      curtainOpening();
      setDone(true);
      return;
    }

    // The page must not scroll while the curtain is down, or the reader can
    // scrub the hero's reveal away before they have seen it.
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    let ctx: ReturnType<typeof gsap.context> | undefined;
    let cancelled = false;

    // DEAD-MAN SWITCH. The sequence rides rAF, and rAF does not run in a
    // background tab — so a page opened in the background would sit behind a
    // black plate with the scroll locked until it was focused. Timers DO
    // fire, so one hands the page over regardless.
    const bail = window.setTimeout(() => {
      if (cancelled) return;
      document.documentElement.style.overflow = prevOverflow;
      curtainOpening();
      setDone(true);
    }, 5200);

    const run = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        const lines = prepareWipe(mark);
        const tl = gsap.timeline();

        addWipeTo(tl, lines, { duration: 0.95, stagger: 0 }, 0.15);

        // The pulse: three rings out of the mark, each on its own beat.
        tl.fromTo(
          "[data-ring]",
          { scale: 0.14, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 1.5,
            ease: "power2.out",
            stagger: 0.34,
          },
          0.2,
        );
        tl.to("[data-ring]", { opacity: 0, duration: 0.5, ease: "none" }, 1.35);

        // The iris. Everything on the plate goes with it, and the hero is
        // told to start the moment the edge begins to move.
        tl.to([mark, ringsRef.current], { opacity: 0, duration: 0.4 }, 1.45);
        tl.to(
          root,
          {
            clipPath: "circle(0% at 50% 50%)",
            duration: 1.15,
            ease: "power3.inOut",
            onStart: () => {
              document.documentElement.style.overflow = prevOverflow;
              curtainOpening();
            },
            onComplete: () => {
              window.clearTimeout(bail);
              setDone(true);
            },
          },
          1.6,
        );
      }, root);
    };

    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(bail);
      document.documentElement.style.overflow = prevOverflow;
      ctx?.revert();
    };
  }, []);

  if (done) return null;

  return (
    <div
      ref={rootRef}
      /* Above the cursor ring and every act: nothing paints over the
         curtain while it is down. */
      className="fixed inset-0 z-[300] flex items-center justify-center bg-night"
      style={{ clipPath: "circle(140% at 50% 50%)" }}
    >
      <div ref={ringsRef} aria-hidden className="absolute inset-0">
        {RINGS.map((d) => (
          <div
            key={d}
            data-ring
            className="absolute top-1/2 left-1/2 aspect-square w-[128svh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/[0.09] opacity-0"
          />
        ))}
      </div>

      <span
        ref={markRef}
        className="font-display relative text-[0.95rem] font-bold tracking-[0.42em] text-paper"
      >
        VEYRA
      </span>
    </div>
  );
}
