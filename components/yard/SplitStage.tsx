"use client";

import { useEffect, useRef } from "react";
import {
  BEAT,
  DRIVE,
  camGroundFrac,
  clamp01,
  runT,
  span,
  storyQ,
  tiltBandBottom,
  tiltSeamFrac,
  tiltT,
} from "./geometry";
import { gsap } from "@/lib/gsap";

/**
 * The driving beat, stated as a seam. Paper above, night below, the truck
 * rolling along the join — and from the pull-back on, the join IS the camera's
 * transformed ground line, so the tyres stay on it without either side
 * measuring the other.
 *
 *   in .. hold   the black floor sweeps up from the bottom of the frame to the
 *                ground line — which is ALREADY rising, because the sweep
 *                overlaps the camera pull-back (DRIVE.zoomIn), per the ref
 *   hold ..      the seam simply tracks camGroundFrac: it rides the ground up
 *                to DRIVE.ground and rests there for the whole follow — the
 *                night band is the services strip's stage, so it never takes
 *                the frame and never lifts away
 */
export const SPLIT = {
  in: DRIVE.zoomIn,
  hold: BEAT.depart,
} as const;

/** Vertical band the speed readout occupies, for the tone hand-off. */
const READOUT_TOP = 0.12;
const READOUT_BOTTOM = 0.3;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Where the paper ends and the night begins, as a fraction of stage height.
 * Takes the RAW pin progress: before the sweep the seam is parked below the
 * frame; during the sweep it chases the (already moving) ground line; through
 * the follow it IS the ground line; and through the tilt it rides on up to
 * the road's far edge.
 */
export function seamAt(p: number): number {
  const t = tiltT(p);
  if (t > 0) return tiltSeamFrac(t);
  const q = storyQ(p);
  if (q <= SPLIT.in) return 1;
  const ground = camGroundFrac(q);
  if (q < SPLIT.hold) return lerp(1, ground, outCubic(span(q, SPLIT.in, SPLIT.hold)));
  return ground;
}

/** The night band's bottom edge — full bleed until the tilt's near edge. */
export const bandBottomAt = (p: number) => tiltBandBottom(tiltT(p));

/**
 * How dark the top-left corner is, 0..1. The seam never climbs past
 * DRIVE.ground, which sits below the readout band — so the readout stays ink
 * on paper for the whole follow, like the reference's KM/H counter.
 */
export function splitTone(p: number): number {
  return clamp01((READOUT_BOTTOM - seamAt(p)) / (READOUT_BOTTOM - READOUT_TOP));
}

/**
 * Alive from the first sweep until the run's handoff frame — at which point
 * the road's west arm is drawn at EXACTLY the band's rectangle (K0 is solved
 * from it), so hiding the band swaps identical pixels and nothing blinks.
 */
export const isSplitActive = (p: number) => storyQ(p) > SPLIT.in && runT(p) < 0.02;

export interface SplitStageProps {
  /** Yard progress, 0..1. Read every frame; never stored. */
  progress: () => number;
  /** Placement in the stage's z-stack. Belongs under the vehicle layer. */
  className?: string;
}

/**
 * REF FRAME 3 — the follow. The night band rises with the pull-back and then
 * holds as the floor of the services strip; the strip itself lives in the
 * section (it needs the stage's metrics), painted between this band and the
 * vehicle layer.
 */
export default function SplitStage({ progress, className }: SplitStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const nightRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = rootRef.current;
    if (!root) return;

    const last = new Map<string, string>();
    const write = (el: HTMLElement | null, prop: string, key: string, value: string) => {
      if (!el || last.get(key) === value) return;
      last.set(key, value);
      el.style.setProperty(prop, value);
    };

    const render = () => {
      const p = progressRef.current();
      const live = isSplitActive(p);

      write(root, "visibility", "vis", live ? "visible" : "hidden");
      if (!live) return;

      const seam = seamAt(p);
      const bottom = bandBottomAt(p);

      // Both bands are scaled, never resized — the seam is a compositor move.
      write(paperRef.current, "transform", "paper", `scaleY(${seam.toFixed(5)})`);
      write(
        nightRef.current,
        "transform",
        "night",
        `translateY(${(seam * 100).toFixed(4)}%) scaleY(${Math.max(0, bottom - seam).toFixed(5)})`,
      );

      // The pill parks bottom-centre once the lens is locked, and stays for
      // the whole run past the cards — gone before the tilt takes the frame.
      const q = storyQ(p);
      const pill =
        span(q, DRIVE.zoomOut + 0.02, DRIVE.zoomOut + 0.06) * (1 - span(q, 0.985, 1));
      write(pillRef.current, "opacity", "pill", pill.toFixed(3));
      write(pillRef.current, "pointer-events", "pillHit", pill > 0.6 ? "auto" : "none");
      // The layer as a whole is visible for the whole beat, so opacity alone
      // would leave a real link in the tab order while it is invisible on
      // screen. Hiding it takes it out of the focus order too.
      write(pillRef.current, "visibility", "pillVis", pill > 0 ? "visible" : "hidden");
    };

    render();
    gsap.ticker.add(render);

    return () => {
      gsap.ticker.remove(render);
    };
  }, []);

  // Every animated property below is owned by the ticker alone — none of it is
  // declared as a React style prop, so a parent re-render can never overwrite a
  // frame mid-beat. The layer starts hidden by class instead.
  return (
    <div
      ref={rootRef}
      className={`pointer-events-none invisible absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <div ref={paperRef} aria-hidden="true" className="absolute inset-0 origin-top bg-paper" />
      <div ref={nightRef} aria-hidden="true" className="absolute inset-0 origin-top bg-night" />

      <div
        ref={pillRef}
        className="pointer-events-none invisible absolute inset-x-0 bottom-[6%] flex justify-center px-5 opacity-0"
      >
        <a
          href="#carriers"
          className="rounded-full border border-paper/30 px-7 py-3 font-mono text-[11px] tracking-[0.28em] text-paper uppercase transition-colors duration-300 hover:border-signal hover:bg-signal focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
        >
          Our services
        </a>
      </div>
    </div>
  );
}
