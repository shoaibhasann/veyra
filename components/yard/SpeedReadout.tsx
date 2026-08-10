"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { clamp01 } from "./geometry";
import { useOdometer } from "@/hooks/useOdometer";
import { gsap } from "@/lib/gsap";

const INK = "var(--color-ink)";
const PAPER = "var(--color-paper)";

export interface SpeedReadoutProps {
  /** km/h, differentiated from the truck's own position every frame. */
  getSpeed: () => number;
  /** Distance logged this leg, in km. */
  getDistance: () => number;
  /** Meter fill, 0..1. Scaled on the x axis rather than re-laid out. */
  barRef: RefObject<HTMLSpanElement | null>;
  /**
   * 0 while the instrument sits on paper, 1 once the split has taken the corner
   * to night. Everything below is currentColor, so one write inverts the block.
   */
  tone?: () => number;
}

export default function SpeedReadout({
  getSpeed,
  getDistance,
  barRef,
  tone,
}: SpeedReadoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const toneRef = useRef(tone);

  useOdometer(speedRef, getSpeed, { pad: 2, smooth: 0.16 });
  useOdometer(distRef, getDistance, { pad: 4, smooth: 0.1 });

  useEffect(() => {
    toneRef.current = tone;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let last = "";
    const paint = () => {
      const get = toneRef.current;
      const el = rootRef.current;
      if (!get || !el) return;

      const t = clamp01(get());
      const key = t.toFixed(2);
      if (key === last) return;
      last = key;

      el.style.color =
        t <= 0
          ? INK
          : t >= 1
            ? PAPER
            : `color-mix(in oklab, ${PAPER} ${(t * 100).toFixed(0)}%, ${INK})`;
    };

    paint();
    gsap.ticker.add(paint);
    return () => {
      gsap.ticker.remove(paint);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex flex-col gap-3 text-ink" aria-hidden="true">
      <div className="flex items-baseline gap-2">
        <span
          ref={speedRef}
          className="font-mono text-[clamp(2.25rem,5.5vw,4.5rem)] leading-none font-bold tabular-nums"
        >
          00
        </span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-current uppercase opacity-45 sm:text-[11px]">
          km/h
        </span>
      </div>

      <span className="relative block h-px w-32 overflow-hidden sm:w-44">
        <span className="absolute inset-0 bg-current opacity-20" />
        <span
          ref={barRef}
          className="absolute inset-0 origin-left bg-signal"
          style={{ transform: "scaleX(0)" }}
        />
      </span>

      <div className="flex items-baseline gap-2">
        <span ref={distRef} className="font-mono text-xs tabular-nums text-current opacity-60">
          0000
        </span>
        <span className="font-mono text-[10px] tracking-[0.28em] text-current uppercase opacity-40">
          km logged
        </span>
      </div>
    </div>
  );
}
