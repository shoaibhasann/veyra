"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * THE RING. One circle that trails the pointer across the whole site,
 * easing toward it rather than snapping — the reference's cursor. It rides
 * gsap's clock (the same one the yard's ticker uses, so there is never a
 * second rAF loop competing with the pin) and blends by DIFFERENCE, which
 * is what lets a single white ring read correctly on paper, on night and
 * over the ocean footage without anyone writing a colour for each act.
 *
 * Inside it sits a small dot marking the true pointer position. It is a
 * CHILD of the ring, so it composites into the ring's blend group and
 * therefore inverts against whatever is underneath by exactly the same
 * rule — the dot can never disagree with the ring's colour, on any act.
 *
 * The native cursor stays: this is an accent, not a replacement, so no
 * hit-target ever becomes harder to aim at. Pointer-only — touch devices
 * and reduced-motion users never see it.
 */
const RING = 42;
/** The centre mark, logical px — read at rest, never at hover scale. */
const DOT = 4;
/** Pointer-follow easing per frame at 60fps; scaled by real delta. */
const EASE = 0.16;
/** What the ring becomes over something clickable. */
const HOVER_SCALE = 1.55;

export default function CursorRing() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;
    // Pointer-only, and never for readers who asked for less motion.
    if (
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const target = { x: innerWidth / 2, y: innerHeight / 2 };
    const at = { x: target.x, y: target.y };
    let scale = 1;
    let scaleTo = 1;
    let shown = false;

    const INTERACTIVE = 'a, button, input, textarea, select, summary, [role="button"], [data-cursor]';

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!shown) {
        shown = true;
        at.x = target.x;
        at.y = target.y;
        gsap.set(ring, { autoAlpha: 1 });
      }
      scaleTo = (e.target as Element | null)?.closest?.(INTERACTIVE) ? HOVER_SCALE : 1;
    };
    const onLeave = () => {
      shown = false;
      gsap.set(ring, { autoAlpha: 0 });
    };

    const tick = () => {
      // Frame-rate independent approach: same feel at 60 and 120Hz.
      const k = 1 - Math.pow(1 - EASE, Math.min(3, gsap.ticker.deltaRatio()));
      at.x += (target.x - at.x) * k;
      at.y += (target.y - at.y) * k;
      scale += (scaleTo - scale) * k;
      ring.style.transform =
        `translate3d(${(at.x - RING / 2).toFixed(1)}px, ${(at.y - RING / 2).toFixed(1)}px, 0) ` +
        `scale(${scale.toFixed(3)})`;
      // The dot rides the ring but not its hover scale: the ring opens up
      // over a link, the mark stays the same size on screen.
      dot.style.transform = `translate3d(-50%, -50%, 0) scale(${(1 / scale).toFixed(3)})`;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[200] rounded-full border border-white opacity-0 mix-blend-difference will-change-transform"
      style={{ width: RING, height: RING }}
    >
      <span
        ref={dotRef}
        className="absolute top-1/2 left-1/2 block rounded-full bg-white will-change-transform"
        style={{ width: DOT, height: DOT, transform: "translate3d(-50%, -50%, 0)" }}
      />
    </div>
  );
}
