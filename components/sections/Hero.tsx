"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { scrambleText, splitLines } from "@/lib/scramble";
import { addWipeTo, wipeSettle } from "@/lib/wipe";
import { whenCurtainOpens } from "@/lib/curtain";

// three.js is ~170KB gzipped and the scene is purely decorative — keep it out
// of the initial bundle and off the server entirely.
const Globe = dynamic(() => import("@/components/scenes/Globe"), { ssr: false });

export default function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const linesRef = useRef<HTMLSpanElement[] | null>(null);

  // Exit-scrub targets. The load reveal owns opacity/y on the [data-hero-reveal]
  // elements themselves, so the exit scrub animates these dedicated WRAPPERS —
  // the two compose (opacities multiply, transforms nest) instead of fighting
  // over the same properties. The heading is safe to drive directly: the load
  // reveal only ever touches the line spans inside it, never the <h1> itself.
  const exitEyebrowRef = useRef<HTMLDivElement>(null);
  const exitSubRef = useRef<HTMLDivElement>(null);
  const exitPillsRef = useRef<HTMLDivElement>(null);
  const exitBottomRef = useRef<HTMLDivElement>(null);
  const globeFieldRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const heading = headingRef.current;
    if (!root || !heading) return;

    const reduce = prefersReducedMotion();
    let cancelled = false;
    let ctx: ReturnType<typeof gsap.context> | undefined;

    const run = () => {
      if (cancelled) return;

      // splitLines caches the pre-split markup and re-splits safely, so a
      // StrictMode remount is fine. It already wraps each line in its own
      // overflow-hidden box and hands back the inner span to animate.
      let lines = linesRef.current;
      if (!lines) {
        // Pin the ink before `.u-wipe` sets color:transparent — currentColor
        // inside the gradient would otherwise resolve against that very
        // declaration and paint the revealed text transparent.
        const final = getComputedStyle(heading).color;
        lines = splitLines(heading, { lineClass: "u-wipe" });
        for (const line of lines) {
          line.style.setProperty("--wipe-final", final);
          // Shrink-wrap, so the edge crosses glyphs and not the measure —
          // block + fit-content, so the line keeps no strut of its own.
          line.style.display = "block";
          line.style.width = "fit-content";
        }
        linesRef.current = lines;
      }

      ctx = gsap.context(() => {
        if (reduce) {
          gsap.set(["[data-hero-reveal]", ...lines], { opacity: 1, y: 0, yPercent: 0 });
          wipeSettle(lines);
          // Markup ships the cue at scale-y-0 for the draw-in, so reset it too.
          gsap.set("[data-scroll-cue-line]", { scaleY: 1, transformOrigin: "top center" });
          return;
        }

        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

        if (lines.length) {
          tl.fromTo(
            lines,
            { yPercent: 118 },
            { yPercent: 0, duration: 1.15, stagger: 0.085 },
            0.15,
          );
          // THE WIPE, over the rise: each line stands up, then its brand-blue
          // edge travels across it and leaves paper-white behind. The two
          // compose because they touch different properties — yPercent on the
          // span, --wipe on its gradient.
          gsap.set(lines, { "--wipe": 0 });
          addWipeTo(tl, lines, { stagger: 0.19 }, 0.4);
        } else {
          tl.fromTo(heading, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, 0.15);
        }

        tl.fromTo(
          "[data-hero-reveal]",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 },
          0.55,
        );

        gsap.to("[data-scroll-cue-line]", {
          scaleY: 1,
          transformOrigin: "top center",
          duration: 1.4,
          ease: "power2.inOut",
          repeat: -1,
          repeatDelay: 0.15,
          yoyo: true,
        });

        // scrambleText is reduced-motion-safe on its own; inside the context so
        // revert() kills the tween if we unmount mid-decode.
        if (eyebrowRef.current) scrambleText(eyebrowRef.current, { duration: 1.1 });
      }, root);
    };

    // Line grouping is measured from real glyph widths, so wait for the
    // webfont — and then for the loader's iris, so the reveal is not spent
    // behind a black plate. whenCurtainOpens resolves on its own timeout if
    // there is no loader on the page.
    const fonts =
      document.fonts && document.fonts.status !== "loaded"
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();
    Promise.all([fonts, whenCurtainOpens()]).then(run).catch(run);

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  // Exit scrub. The section is sticky (md+), so the intro slides up OVER a
  // hero that stays put; this timeline mirrors the load reveal by carrying the
  // copy upward and out across the first ~90vh of scroll. Numeric start/end
  // (no trigger element) keeps ScrollTrigger from measuring the sticky section
  // itself, and every transform lands on an INNER wrapper — the sticky element
  // must never be transformed or the pin breaks.
  useEffect(() => {
    const root = rootRef.current;
    const heading = headingRef.current;
    const eyebrow = exitEyebrowRef.current;
    const sub = exitSubRef.current;
    const pills = exitPillsRef.current;
    const bottom = exitBottomRef.current;
    const globeField = globeFieldRef.current;
    const glow = glowRef.current;
    if (!root || !heading || !eyebrow || !sub || !pills || !bottom || !globeField || !glow) {
      return;
    }

    const mm = gsap.matchMedia();

    // Reduced motion: no exit transforms and no sticky pin — the hero simply
    // scrolls away. `relative`, NOT `static`: the starfield/globe/cursor are
    // absolutely positioned against this section and need its containing block.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(root, { position: "relative" });
    });

    // Mobile keeps today's in-flow behaviour (the markup only goes sticky at
    // md+), so the scrub is created for md+ pointers only.
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        defaults: { ease: "power1.in" },
        scrollTrigger: {
          id: "hero-exit",
          start: 0,
          end: () => Math.round(window.innerHeight * 0.9),
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      // Scroll cue + bottom mono strip let go first.
      tl.to(bottom, { autoAlpha: 0, y: "-4vh", duration: 0.3 }, 0);

      // Copy column travels upward and fades — eyebrow and pills lead, the
      // sub copy follows, the headline trails by ~15% of the run.
      tl.to([eyebrow, pills], { y: "-12vh", autoAlpha: 0, duration: 0.85 }, 0);
      tl.to(sub, { y: "-12vh", autoAlpha: 0, duration: 0.85 }, 0.06);
      tl.to(heading, { y: "-12vh", autoAlpha: 0, duration: 0.85 }, 0.15);

      // The globe (and the sunrise glow welded to its limb) recedes slower
      // than the text: small upward drift, slight shrink, dimmed — not gone.
      tl.to(
        [globeField, glow],
        { y: "-6vh", scale: 0.96, opacity: 0.55, duration: 1, ease: "none" },
        0,
      );
    });

    // matchMedia.revert() kills the timeline AND its ScrollTrigger and clears
    // every inline style either branch set.
    return () => mm.revert();
  }, []);

  // The cursor is site-wide now (components/CursorRing.tsx) — one ring with
  // one centre dot for every act, so the hero no longer runs its own.

  return (
    <section
      id="top"
      ref={rootRef}
      /* The hero drives the wipe itself, on its load timeline — the
         site-wide scanner must not claim these lines a second time. */
      data-reveal-skip
      // Sticky (md+) so the intro section slides up OVER the hero — same
      // 100svh in the flow, so no downstream trigger moves. z-0 keeps it under
      // the z-10 content layer in page.tsx; the nav is fixed at z-30+. The
      // exit effect flips position back to relative under reduced motion.
      className="relative z-0 h-[100svh] w-full overflow-hidden bg-[#050505] text-paper md:sticky md:top-0"
    >
      {/* Starfield — two static repeating layers, kept extremely subtle. */}
      <div aria-hidden className="hero-stars-far pointer-events-none absolute inset-0" />
      <div aria-hidden className="hero-stars-near pointer-events-none absolute inset-0" />

      {/* Warm sunrise glow bleeding off the globe's upper limb. */}
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(65vh 48vh at 76% 16%, rgba(255,122,47,0.15), rgba(255,122,47,0.04) 55%, transparent 78%)",
        }}
      />

      {/* Globe — ~95vh sphere centred at 76% / 52%, bleeding off the right and
          bottom edges. The silhouette lands at ~84% of the container's shorter
          side (FRAME_EXTENT in Globe.tsx), so a ~113vh box yields the ~95vh
          planet. Centre nudged to 76% so the widest headline line still kisses
          the left limb after the type shrink. Dimmed under the copy on small
          screens. */}
      {/* The exit scrub drives THIS untransformed wrapper (y/scale/opacity);
          the box inside keeps its Tailwind centring translate untouched, so
          GSAP never has to decompose a pre-existing percentage transform. */}
      <div ref={globeFieldRef} aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-[76%] top-[52%] h-[113vh] w-[113vh] -translate-x-1/2 -translate-y-1/2 opacity-40 md:opacity-100">
          <Globe className="h-full w-full" />
        </div>
      </div>

      {/* Mobile-only scrim so the copy stays legible over the centred sphere. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/40 to-[#050505]/80 md:hidden"
      />

      {/* justify-start + a vh/px-floored top pad keeps the headline in the
          lower band of the hero AND below the nav's vertical menu column
          (px-fixed, ends ~266px) at every desktop viewport height. The column
          is a LEFT-anchored rail at 18% of the viewport, capped at 46vw.
          Measured at 1440x900 with the webfont: the widest line (ACCOUNTED)
          ends at ~53vw, crossing the globe's left limb (~47vw) by about one
          glyph — the reference's "slight overlap". Mobile keeps the
          centered/stacked behaviour. */}
      <div className="relative z-10 flex h-full w-full flex-col justify-center px-5 pt-[8vh] md:px-8 lg:justify-start lg:pl-[18%] lg:pr-0 lg:pt-[max(32vh,20rem)]">
        <div className="max-w-[62rem] lg:max-w-[46vw]">
          {/* Plain wrappers below exist for the exit scrub only — child margins
              collapse straight through them, so the column's rhythm is
              untouched while load reveal (children) and exit (wrappers)
              animate independently. */}
          <div ref={exitEyebrowRef}>
            <p data-hero-reveal className="mb-6 opacity-0">
              <span
                ref={eyebrowRef}
                className="text-xs font-bold uppercase tracking-[0.2em] text-paper"
              >
                One operator
              </span>
            </p>
          </div>

          {/* The block spans below define the three line boxes that splitLines
              measures — no max-width, so a wide glyph can never re-wrap them. */}
          <h1 ref={headingRef} className="u-display-hero whitespace-nowrap text-paper">
            <span className="block">Every mile</span>
            <span className="block">Accounted</span>
            <span className="block">For</span>
          </h1>

          <div ref={exitSubRef}>
            <p
              data-hero-reveal
              className="mt-7 text-sm leading-relaxed text-paper/60 opacity-0 md:text-base"
            >
              <span className="block">Freight forwarding, land transport and</span>
              <span className="block">customs brokerage — one contract, one</span>
              <span className="block">accountable team across APAC.</span>
            </p>
          </div>

          <div ref={exitPillsRef}>
            <div data-hero-reveal className="mt-9 flex flex-wrap items-center gap-3 opacity-0">
              <a
                href="#contact"
                className="rounded-full bg-paper px-7 py-3.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-black transition-colors duration-300 hover:bg-signal hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                Talk to us
              </a>
              <a
                href="#carriers"
                className="rounded-full border border-paper/40 px-7 py-3.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:border-paper/70 hover:bg-paper/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                Our network
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={exitBottomRef}
        aria-hidden
        className="absolute inset-x-0 bottom-6 z-10 flex items-end justify-between px-5 md:px-8"
      >
        <div className="flex items-center gap-3">
          <span
            data-scroll-cue-line
            className="block h-10 w-px origin-top scale-y-0 bg-paper/40"
          />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-paper/40">
            Scroll
          </span>
        </div>
        <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.28em] text-paper/30 md:block">
          Sea · Air · Road · Customs
        </span>
      </div>

    </section>
  );
}
