"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import { whenCurtainOpens } from "@/lib/curtain";
import { prepareWipe, wipeDuration, wipeSettle } from "@/lib/wipe";

/**
 * THE WIPE, everywhere. One pass over the page wires every heading and
 * paragraph to the same reveal the hero uses: the brand edge travels the
 * line and leaves the ink behind it, once, as the line comes into view.
 *
 * OPT-OUT, not opt-in: text is the default case, so the scanner takes all of
 * it and anything with its own choreography carries `data-reveal-skip` (the
 * hero, the pinned yard, the intro's word-scrub, the client board the
 * aircraft already reveals). Buttons and links are never touched — a control
 * that paints itself in is a control you cannot read while it does.
 */

/** What gets the treatment. */
const SELECTOR = "h1, h2, h3, h4, p, blockquote, figcaption, li";

/** Never, regardless of where it sits. */
const FORBIDDEN = "a, button, [role='button'], input, textarea, select, nav, [data-split]";

/** Long paragraphs must not take longer than short ones just for having
    more lines: the per-line offset shrinks as the count grows. */
const staggerFor = (lines: number) => Math.min(0.15, Math.max(0.045, 0.65 / Math.max(1, lines)));

export default function TextReveal() {
  useEffect(() => {
    const reduce = prefersReducedMotion();
    let ctx: ReturnType<typeof gsap.context> | undefined;
    let cancelled = false;

    // What this pass took ownership of, kept for the re-measure. The
    // selection filter cannot be re-run to find them again: it rejects
    // anything already carrying `data-split`, and `closest` matches the
    // element ITSELF — so a second query would skip every element this
    // component had split, which is most of them.
    let owned: HTMLElement[] | null = null;

    const run = (resplit = false) => {
      if (cancelled) return;
      const main = document.querySelector("main");
      if (!main) return;

      const targets = owned ?? [...main.querySelectorAll<HTMLElement>(SELECTOR)].filter((el) => {
        if (el.closest("[data-reveal-skip]")) return false;
        if (el.closest(FORBIDDEN)) return false;
        if (el.querySelector(FORBIDDEN)) return false;
        // Text only, and enough of it to be worth a reveal.
        const text = (el.textContent ?? "").trim();
        if (text.length < 2) return false;
        // Already handled by an ancestor in this same list.
        if (el.parentElement?.closest(SELECTOR)) return false;
        return true;
      });
      owned = targets;

      ctx = gsap.context(() => {
        for (const el of targets) {
          // The re-measure itself is prepareWipe's business: it stamps the
          // width its lines were cut at and re-cuts when that no longer
          // holds. Clearing the split flag here would be actively WRONG —
          // it is what tells splitLines to put the original markup back
          // before measuring, and without it the splitter would re-measure
          // its own line boxes and faithfully reproduce the stale wrap.
          const lines = prepareWipe(el);
          const start = el.closest("#testimonials") ? "top bottom" : "top 88%";
          // Rebuilt after the reader has already passed it: put it straight
          // into its finished state rather than replaying the reveal under
          // them (or worse, leaving it unrevealed above the fold).
          const passed =
            el.getBoundingClientRect().top <
            window.innerHeight * (start === "top bottom" ? 1 : 0.88);
          if (reduce || (resplit && passed)) {
            wipeSettle(lines);
            continue;
          }
          const step = staggerFor(lines.length);
          // The client board is handed over by the aircraft: its first screen
          // must be FINISHED at that moment, or the reader watches a revealed
          // heading un-reveal. Starting it the instant it enters from below
          // buys a full screen of runway before the pin lets go.
          const tl = gsap.timeline({
            scrollTrigger: { trigger: el, start, once: true },
          });
          lines.forEach((line, i) => {
            tl.to(
              line,
              { "--wipe": 100, duration: wipeDuration(line), ease: "power1.inOut" },
              i * step,
            );
          });
        }
        ScrollTrigger.refresh();
      }, main);
    };

    // Lines are measured from real glyph widths (webfont), and nothing should
    // start behind the curtain.
    const fonts =
      document.fonts && document.fonts.status !== "loaded"
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();
    Promise.all([fonts, whenCurtainOpens()]).then(() => run()).catch(() => run());

    // THE RE-MEASURE. Lines are cut from the wrap as it was; change the
    // width and every one of them is a promise about a layout that no longer
    // exists. Debounced through a timer rather than rAF, which a background
    // tab starves exactly when a window is being resized.
    let width = window.innerWidth;
    let pending = 0;
    const onResize = () => {
      // Height-only changes (mobile URL bars, devtools) do not re-wrap text.
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        if (cancelled) return;
        ctx?.revert();
        run(true);
      }, 220);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.clearTimeout(pending);
      window.removeEventListener("resize", onResize);
      ctx?.revert();
    };
  }, []);

  return null;
}
