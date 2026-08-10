"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { gsap } from "@/lib/gsap";

export interface WheelRotationOptions {
  /**
   * Rendered diameter of one wheel in CSS pixels. Pass a getter when the value
   * is measured from the DOM so a resize is picked up without remounting.
   */
  wheelDiameterPx: number | (() => number);
  /**
   * Distance the body has travelled, in the same CSS pixel space as the wheel.
   * Must be the SAME scroll-driven value that positions the body, so the wheels
   * stay locked to it while scrubbing in either direction.
   */
  getDistancePx: () => number;
  /** 1 = travelling right (clockwise). Default 1. */
  direction?: 1 | -1;
}

type Setter = (value: number) => void;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Rotates every ref in proportion to distance travelled:
 *
 *   rotationDeg = (distancePx / (PI * wheelDiameterPx)) * 360
 *
 * Runs on `gsap.ticker` rather than owning a ScrollTrigger, so it simply reads
 * whatever `getDistancePx()` currently reports and therefore stays welded to
 * the body at any scroll position, including reverse scrub. Inert under
 * `prefers-reduced-motion`.
 */
export function useWheelRotation(
  refs: RefObject<HTMLElement | null>[],
  opts: WheelRotationOptions,
): void {
  const refsRef = useRef(refs);
  const optsRef = useRef(opts);

  // Callers pass fresh array/object literals every render; mirror them into
  // refs so the ticker always sees the latest without re-running the effect.
  useIsomorphicLayoutEffect(() => {
    refsRef.current = refs;
    optsRef.current = opts;
  });

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const els: (HTMLElement | null)[] = [];
    const setters: (Setter | null)[] = [];
    let lastDeg = Number.NaN;
    let running = false;

    const update = () => {
      const list = refsRef.current;
      const o = optsRef.current;

      const diameter =
        typeof o.wheelDiameterPx === "function" ? o.wheelDiameterPx() : o.wheelDiameterPx;
      const distance = o.getDistancePx();

      let deg = lastDeg;
      if (diameter > 0 && Number.isFinite(diameter) && Number.isFinite(distance)) {
        deg = (distance / (Math.PI * diameter)) * 360 * (o.direction ?? 1);
      }
      if (!Number.isFinite(deg)) deg = 0;

      const moved = deg !== lastDeg;
      lastDeg = deg;

      if (els.length > list.length) {
        els.length = list.length;
        setters.length = list.length;
      }

      for (let i = 0; i < list.length; i++) {
        const el = list[i]?.current ?? null;
        let rebuilt = false;
        if (el !== els[i]) {
          els[i] = el;
          setters[i] = el ? (gsap.quickSetter(el, "rotation", "deg") as Setter) : null;
          rebuilt = true;
        }
        const set = setters[i];
        if (set && (moved || rebuilt)) set(deg);
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      lastDeg = Number.NaN;
      gsap.ticker.add(update);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      gsap.ticker.remove(update);
    };

    const media = window.matchMedia ? window.matchMedia(REDUCED_MOTION_QUERY) : null;

    const sync = () => {
      if (media?.matches) {
        stop();
        for (const ref of refsRef.current) {
          if (ref?.current) gsap.set(ref.current, { rotation: 0 });
        }
        els.length = 0;
        setters.length = 0;
      } else {
        start();
      }
    };

    sync();
    media?.addEventListener("change", sync);

    return () => {
      media?.removeEventListener("change", sync);
      stop();
      els.length = 0;
      setters.length = 0;
    };
  }, []);
}

export default useWheelRotation;
