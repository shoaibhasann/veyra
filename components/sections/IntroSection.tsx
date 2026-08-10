"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import { prepareWipe, wipeGroup, wipeSettle } from "@/lib/wipe";

const STATEMENT =
  "Most shippers run four vendors, five portals and one very long email thread. Veyra replaces all of it with a single operator — ocean and air forwarding, cross-border trucking and licensed customs brokerage — on one contract, one rate card, and one team that picks up the phone at 3am when a box gets rolled in Singapore.";

export default function IntroSection() {
  const rootRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    const copy = copyRef.current;
    if (!root || !body || !copy) return;

    const reduce = prefersReducedMotion();

    if (reduce) {
      // Land on the final state — the rule is scale-x-0 in markup, so it needs
      // an explicit reset or the divider never appears.
      wipeSettle(prepareWipe(copy));
      gsap.set("[data-intro-rule]", { scaleX: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // THE READ-ALONG. Same window as before, but the reveal is now the
      // site's own wipe: the brand edge travels each line and leaves ink
      // behind it, scrubbed by the reader's scroll. (It replaces a
      // word-by-word grey→ink tint, which had no relationship to the
      // reveal every other block on the page uses.)
      prepareWipe(copy);
      ScrollTrigger.create({
        trigger: copy,
        start: "top 78%",
        end: "bottom 55%",
        scrub: 0.45,
        // A tighter span than a card's: on a paragraph this long the lines
        // should read one after another, not bloom together.
        onUpdate: (self) => wipeGroup(copy, self.progress, 0.3),
      });

      // Trigger on the copy body, NOT the section root: the root now starts
      // 130svh higher (the night-to-day cover), so a root-based start would
      // finish the rule long before the copy is even on screen.
      gsap.fromTo(
        "[data-intro-rule]",
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: "left center",
          ease: "none",
          scrollTrigger: {
            trigger: body,
            start: "top 70%",
            end: "bottom 60%",
            scrub: 0.5,
          },
        },
      );
    }, root);

    // No local refresh here — SmoothScroll owns the one authoritative refresh
    // after document.fonts.ready, once every pinned section has registered.
    return () => ctx.revert();
  }, []);

  return (
    // z-10 card over the sticky hero (z-0). NOTE: no bg-paper on the section
    // itself any more — the cover head must stay TRANSPARENT above its arc, so
    // the opaque white lives on the copy wrapper below instead.
    <section id="about" ref={rootRef} className="relative z-10 w-full text-ink">
      {/* Crescent-arc cover. The card's top edge is the underside of a giant
          circle (implemented as a radial-gradient mask in .intro-cover-sky):
          it dips lowest (~14svh) at screen centre and rises toward both sides.
          Everything ABOVE the arc is INTENTIONALLY fully transparent — the
          sticky hero's dark space + globe stay visible through it while the
          card slides up. (A previous verifier demanded an opaque top edge;
          that requirement is obsolete, superseded by this arc design.)
          Below the arc the card is opaque, and the gradient is RADIAL —
          concentric with the mask ellipse, so the brightness bands run
          parallel to the arc: near-black indigo (#060a24) right at the arc
          glowing outward through #2456E6 → #4A8CFF (peak) → #9FC3FF →
          #EAF2FF → white, seamless into the copy area. The `intro-cover`
          class is the single source of the ellipse geometry (custom
          properties) that mask, gradient and glow all share. Pure CSS:
          renders unchanged on mobile and under reduced motion. */}
      <div aria-hidden className="intro-cover relative h-[130svh] w-full">
        {/* Card face — blue→white gradient, masked to the arc. */}
        <div className="intro-cover-sky absolute inset-0" />

        {/* Faint stars in the deep-blue band only: top-[16svh] starts below
            the arc's deepest dip (14svh at centre; the arc is higher at the
            sides), and the mask dissolves them before the mid blues. */}
        <div
          className="absolute inset-x-0 top-[16svh] h-[30svh] overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent)] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
        >
          <div className="hero-stars-far absolute inset-0 opacity-25" />
          <div className="hero-stars-near absolute inset-0 opacity-20" />
        </div>

        {/* Atmosphere rim light along the arc edge — same ellipse geometry as
            the card mask, blurred, brightest at the centre of the arc. */}
        <div className="intro-cover-glow absolute inset-x-0 top-0 h-[32svh]" />
      </div>

      {/* Opaque white lives here (full-bleed wrapper, not the max-w body) so
          the transparent arc head above never leaks page background at the
          sides on ultra-wide screens. */}
      <div className="w-full bg-paper">
      <div
        ref={bodyRef}
        className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-2 lg:gap-20"
      >
        {/* LEFT — parks itself and stays: the plate and the promise hold
            still while the argument scrolls past them, and only when the
            right column runs out does the whole section move on. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[0.7rem] tracking-[0.28em] text-ink/45 uppercase">
              (01) The problem
            </span>
            <span
              data-intro-rule
              aria-hidden
              className="block h-px flex-1 origin-left scale-x-0 bg-ink/15"
            />
          </div>

          <div className="mt-8 w-full max-w-[420px] overflow-hidden">
            <img
              src="/assets/interchange.webp"
              alt="Freight moving across a multi-level highway interchange"
              width={1600}
              height={1200}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full select-none"
            />
          </div>

          {/* Four short blocks, each comfortably inside the column at the
              top of the clamp — the previous wording re-wrapped and stranded
              "is" on a line of its own. */}
          <p className="u-display mt-10 text-[clamp(2.1rem,4.4vw,3.9rem)] leading-[1.02] text-balance">
            <span className="block text-ink/35">We move</span>
            <span className="block text-ink/35">the cargo.</span>
            <span className="block">We carry</span>
            <span className="block">the risk.</span>
          </p>
        </div>

        {/* RIGHT — the column that actually scrolls. */}
        <div className="lg:pt-2">
          <p
            ref={copyRef}
            /* Owns its own word-by-word ink scrub. */
            data-reveal-skip
            className="font-display max-w-[26ch] text-[clamp(1.5rem,3.2vw,2.5rem)] leading-[1.14] font-semibold tracking-[-0.02em] uppercase"
          >
            {STATEMENT}
          </p>

          <a
            href="#insights"
            className="mt-10 inline-flex items-center gap-3 rounded-full border border-ink/25 px-8 py-4 font-mono text-[11px] tracking-[0.24em] text-ink uppercase transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
          >
            What we actually do
          </a>

          <p className="mt-20 border-b border-ink/12 pb-4 text-sm text-ink/55">
            What the ledger says
          </p>

          <div className="mt-4">
            {[
              {
                figure: "14",
                label: "Countries covered by our own offices and bonded partners across APAC.",
              },
              {
                figure: "4h",
                label: "Median turnaround on a new lane quote, including customs and drayage.",
              },
              {
                figure: "99.2%",
                label:
                  "Of 2025 shipments cleared without a single detention or demurrage charge.",
              },
            ].map((s) => (
              <div key={s.figure} className="border-b border-ink/12 py-10 md:py-14">
                <p className="font-display text-[clamp(3.4rem,8vw,6.5rem)] leading-[0.9] font-extrabold tracking-[-0.04em]">
                  {s.figure}
                </p>
                <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-ink/55">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
