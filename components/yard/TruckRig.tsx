/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";
import {
  LAYER,
  SPRITE,
  TRUCK_SHADOW,
  TRUCK_W,
  WHEEL_ORIGIN,
  WHEEL_PLACEMENTS,
  pct,
} from "./geometry";

export interface TruckRigProps {
  /** Carries the per-frame `translate3d(...)` of the truck's canvas corner. */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** Five overlays, ordered trailer bogie -> drive tandem -> steer axle. */
  wheelRefs: RefObject<HTMLImageElement | null>[];
}

/**
 * The BARE tractor + skeletal trailer. It stays bare for the whole side leg —
 * the load is the separate container element composited onto the measured deck
 * plane, never a cross-fade to the pre-loaded truck-side render, which would
 * make the box jump in hue and proportion at the swap.
 */
export default function TruckRig({ bodyRef, wheelRefs }: TruckRigProps) {
  return (
    <div
      ref={bodyRef}
      className="absolute top-0 left-0 will-change-transform"
      style={{ width: pct(TRUCK_W), zIndex: LAYER.truck }}
      aria-hidden="true"
    >
      {/* Percentages of this wrapper are the truck canvas's own fractions, so
          the shadow sits on the measured ground line and travels for free. */}
      <span
        className="absolute block"
        style={{
          left: pct(TRUCK_SHADOW.left),
          width: pct(TRUCK_SHADOW.width),
          top: pct(TRUCK_SHADOW.top),
          height: pct(TRUCK_SHADOW.height),
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.28) 0%, rgba(17,17,17,0.11) 46%, rgba(17,17,17,0) 74%)",
        }}
      />

      <img
        src={SPRITE.truck.src}
        alt=""
        width={SPRITE.truck.w}
        height={SPRITE.truck.h}
        decoding="async"
        draggable={false}
        className="relative block h-auto w-full select-none"
      />

      {WHEEL_PLACEMENTS.map((w, i) => (
        <img
          key={i}
          ref={wheelRefs[i]}
          src={SPRITE.wheel.src}
          alt=""
          width={SPRITE.wheel.w}
          height={SPRITE.wheel.h}
          decoding="async"
          draggable={false}
          className="absolute block h-auto select-none will-change-transform"
          style={{
            left: `${w.leftPct.toFixed(4)}%`,
            top: `${w.topPct.toFixed(4)}%`,
            width: `${w.widthPct.toFixed(4)}%`,
            transformOrigin: WHEEL_ORIGIN,
          }}
        />
      ))}
    </div>
  );
}
