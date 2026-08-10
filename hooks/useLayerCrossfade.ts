"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { gsap } from "@/lib/gsap";

export interface CrossfadeLayer {
  ref: RefObject<HTMLElement | null>;
  /** Progress 0..1 at which this layer has reached full opacity. */
  in: number;
  /** Progress at which it has finished fading back out. Omit to stay visible. */
  out?: number;
  /** Crossfade width in progress units. Default 0.06. */
  fade?: number;
}

type Setter = (value: number) => void;

const DEFAULT_FADE = 0.06;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Linear 0..1 ramp; a zero-width window degrades to a hard step at `to`. */
function ramp(value: number, from: number, to: number): number {
  if (!(to > from)) return value >= to ? 1 : 0;
  const t = (value - from) / (to - from);
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/**
 * Drives opacity for a stack of absolutely-positioned layers off a single
 * progress value, so exactly the intended layers are lit at any point in the
 * scroll. Fully transparent layers get `visibility: hidden` to keep them out of
 * compositing. This is the handoff between the cheap 2D layers and the
 * camera-change asset.
 *
 * Windows are defined by their completion points: a layer ramps up over
 * [in - fade, in] and, when `out` is given, back down over [out - fade, out].
 */
export function useLayerCrossfade(
  layers: CrossfadeLayer[],
  getProgress: () => number,
): void {
  const layersRef = useRef(layers);
  const progressRef = useRef(getProgress);

  useIsomorphicLayoutEffect(() => {
    layersRef.current = layers;
    progressRef.current = getProgress;
  });

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const els: (HTMLElement | null)[] = [];
    const setters: (Setter | null)[] = [];
    const opacities: number[] = [];
    const visible: boolean[] = [];

    const update = () => {
      const list = layersRef.current;
      const raw = progressRef.current();
      const p = Number.isFinite(raw) ? raw : 0;

      if (els.length > list.length) {
        els.length = list.length;
        setters.length = list.length;
        opacities.length = list.length;
        visible.length = list.length;
      }

      for (let i = 0; i < list.length; i++) {
        const layer = list[i];
        const el = layer?.ref?.current ?? null;

        let rebuilt = false;
        if (el !== els[i]) {
          els[i] = el;
          setters[i] = el ? (gsap.quickSetter(el, "opacity") as Setter) : null;
          rebuilt = true;
        }
        if (!el) continue;

        const fade = layer.fade ?? DEFAULT_FADE;
        let value = ramp(p, layer.in - fade, layer.in);
        if (layer.out !== undefined) {
          value *= 1 - ramp(p, layer.out - fade, layer.out);
        }
        value = Math.round(value * 1000) / 1000;

        if (rebuilt || value !== opacities[i]) {
          opacities[i] = value;
          setters[i]?.(value);
        }

        const show = value > 0;
        if (rebuilt || show !== visible[i]) {
          visible[i] = show;
          el.style.visibility = show ? "" : "hidden";
        }
      }
    };

    update();
    gsap.ticker.add(update);

    return () => {
      gsap.ticker.remove(update);
      els.length = 0;
      setters.length = 0;
      opacities.length = 0;
      visible.length = 0;
    };
  }, []);
}

export default useLayerCrossfade;
