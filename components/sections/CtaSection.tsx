"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * THE ASK. Night, a radar of concentric arcs, and one orange button that
 * does not sit still: it chases the pointer across the panel with a trail
 * of its own after-images, so the invitation feels like something moving
 * toward you rather than a control parked on a background.
 *
 * The trail is real motion, not a blur filter: five stacked discs, each
 * lerping to the pointer a little slower than the one in front, so the
 * shape stretches when the pointer is fast and gathers back into a circle
 * when it stops — the smear a real object leaves, not a static gradient.
 *
 * Pointer-only. On touch and under reduced motion the disc simply parks on
 * its mark and behaves like the link it has always been.
 */
const TRAIL = [
  { k: 0.24, scale: 1, alpha: 1 },
  { k: 0.17, scale: 0.95, alpha: 0.5 },
  { k: 0.12, scale: 0.88, alpha: 0.3 },
  { k: 0.085, scale: 0.8, alpha: 0.18 },
  { k: 0.06, scale: 0.72, alpha: 0.1 },
];

export default function CtaSection() {
  const rootRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const discRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    if (
      window.matchMedia("(hover: none)").matches ||
      prefersReducedMotion()
    ) {
      return;
    }

    // The rest position: right of the headline, where the disc waits.
    const home = () => {
      const r = field.getBoundingClientRect();
      return { x: r.width * 0.72, y: r.height * 0.52 };
    };

    const target = home();
    const at = TRAIL.map(() => ({ ...target }));
    // 0 outside the panel, 1 inside — the disc is a pointer companion, not a
    // decoration parked on the background, so it has no business being on
    // screen when the pointer is somewhere else on the page.
    let want = 0;
    let show = 0;

    const onEnter = () => {
      want = 1;
    };
    const onMove = (e: PointerEvent) => {
      const r = field.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      // First move after entering: put the whole trail under the pointer, or
      // it flies in from the last place the pointer left.
      if (show < 0.02) for (const a of at) { a.x = target.x; a.y = target.y; }
      want = 1;
    };
    const onLeave = () => {
      want = 0;
    };

    const tick = () => {
      const d = Math.min(3, gsap.ticker.deltaRatio());
      show += (want - show) * (1 - Math.pow(1 - 0.16, d));
      for (let i = 0; i < TRAIL.length; i++) {
        const el = discRefs.current[i];
        if (!el) continue;
        const k = 1 - Math.pow(1 - TRAIL[i].k, d);
        at[i].x += (target.x - at[i].x) * k;
        at[i].y += (target.y - at[i].y) * k;
        el.style.transform =
          `translate3d(${at[i].x.toFixed(1)}px, ${at[i].y.toFixed(1)}px, 0) ` +
          `translate(-50%, -50%) scale(${(TRAIL[i].scale * (0.72 + 0.28 * show)).toFixed(3)})`;
        el.style.opacity = (TRAIL[i].alpha * show).toFixed(3);
      }
    };

    field.addEventListener("pointerenter", onEnter);
    field.addEventListener("pointermove", onMove, { passive: true });
    field.addEventListener("pointerleave", onLeave);
    gsap.ticker.add(tick);

    return () => {
      field.removeEventListener("pointerenter", onEnter);
      field.removeEventListener("pointermove", onMove);
      field.removeEventListener("pointerleave", onLeave);
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <section id="contact" ref={rootRef} className="w-full bg-night text-paper">
      <div
        ref={fieldRef}
        className="relative isolate flex min-h-[92svh] w-full items-center justify-center overflow-hidden px-5 py-28 md:px-8"
      >
        {/* The radar: concentric arcs, barely there, centred low so the
            headline sits inside the widest ring. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {[0.42, 0.58, 0.74, 0.9, 1.06, 1.22].map((r) => (
            <span
              key={r}
              className="absolute top-1/2 left-1/2 aspect-square rounded-full border border-paper/[0.06]"
              style={{
                width: `${r * 100}svh`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>

        {/* THE DISC. Trail first in the DOM so the head paints over it. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {TRAIL.map((t, i) => (
            <div
              key={i}
              ref={(el) => {
                discRefs.current[i] = el;
              }}
              className="absolute top-0 left-0 flex items-center justify-center rounded-full will-change-transform"
              style={{
                width: "clamp(116px, 13vw, 176px)",
                height: "clamp(116px, 13vw, 176px)",
                background: "var(--color-signal)",
                opacity: 0,
                // Only the tail is soft: a blurred head would read as a
                // glow, and the reference's disc has a hard edge.
                filter: i === 0 ? "none" : `blur(${i * 5}px)`,
                zIndex: TRAIL.length - i,
              }}
            >
              {i === 0 && (
                <span className="font-mono text-center text-[12px] leading-[1.35] font-bold tracking-[0.16em] text-paper uppercase">
                  Work
                  <br />
                  with us
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[54rem] text-center">
          {/* The measure lives on the HEADING, not the wrapper: `ch` resolves
              against the element's own font-size, so 16ch on a 16px wrapper
              was a 162px column and the question broke into four stacked
              words. On the h2 the same unit means sixteen of ITS characters. */}
          <h2 className="u-display mx-auto max-w-[15ch] text-[clamp(2.4rem,6.4vw,5.4rem)] leading-[0.94] text-balance">
            Ready to move smarter?
          </h2>
          <p className="mx-auto mt-8 max-w-[40ch] text-sm leading-relaxed text-paper/60 sm:text-base">
            No call centres, no runaround — a named desk that knows your lane and
            picks up when it matters.
          </p>

          {/* The real control, always reachable: the disc is decoration that
              happens to be beautiful, this is the link. */}
          <a
            href="mailto:desk@veyra.freight"
            className="mt-10 inline-flex items-center gap-3 rounded-full border border-paper/25 px-8 py-4 font-mono text-[11px] tracking-[0.24em] text-paper uppercase transition-colors duration-300 hover:border-paper hover:bg-paper hover:text-night focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
          >
            Talk to a controller
          </a>
        </div>
      </div>
    </section>
  );
}
