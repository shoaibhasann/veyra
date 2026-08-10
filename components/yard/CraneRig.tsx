/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";
import {
  BOOM_MOUNT,
  BOOM_ORIGIN,
  CRANE_BODY_W,
  CRANE_SHADOW,
  CRANE_WHEEL_CLIP,
  CRANE_WHEEL_ORIGIN,
  CRANE_WHEEL_PLACEMENTS,
  LAYER,
  SPRITE,
  pct,
} from "./geometry";

export interface CraneRigProps {
  /** Carries the per-frame `translate3d(...)` of the chassis canvas corner. */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** Carries the per-frame `rotate(...)` about the measured pivot bolt. */
  boomRef: RefObject<HTMLDivElement | null>;
  /**
   * The telescoping outer barrel + head: same sprite, same pivot origin, but
   * its per-frame transform adds a translate ALONG the drawn boom axis — the
   * two copies' barrel edges stay collinear, so the slide reads as the barrel
   * extending out of the base section.
   */
  boomHeadRef: RefObject<HTMLDivElement | null>;
  /** Ground shadow — welded to the crane lane, travels with the body. */
  shadowRef: RefObject<HTMLSpanElement | null>;
  /** Two overlays, front and rear, each rolled by the body's own travel. */
  wheelRefs: RefObject<HTMLImageElement | null>[];
}

/**
 * The machine, assembled from its measured parts instead of one still image:
 *
 *   chassis   crane-body-cut — the translating root; its wheels are live
 *   boom      crane-boom-cut — scaled by the solved k, pivot-welded to the
 *             chassis bracket, rotated per frame about that bolt
 *   spreader  lives OUTSIDE this wrapper (SpreaderRig): it hangs from the boom
 *             head in world space and must draw above the carried box, while
 *             the boom itself draws below it
 *
 * DOM order does the metalwork: the boom is painted first so the chassis's
 * dark pivot bracket renders IN FRONT of the boom's pivot end, exactly as the
 * real machine stacks.
 */
export default function CraneRig({
  bodyRef,
  boomRef,
  boomHeadRef,
  shadowRef,
  wheelRefs,
}: CraneRigProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: LAYER.crane }}
      aria-hidden="true"
    >
      {/* Tighter and darker than the truck's: this is the near lane, and its
          own contact patch is what separates the machine from the trailer it
          works in front of. */}
      <span
        ref={shadowRef}
        className="absolute top-0 left-0 origin-center will-change-transform"
        style={{
          width: pct(CRANE_SHADOW.width),
          height: pct(0.026),
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.34) 0%, rgba(17,17,17,0.13) 44%, rgba(17,17,17,0) 72%)",
        }}
      />

      <div
        ref={bodyRef}
        className="absolute top-0 left-0 will-change-transform"
        style={{ width: pct(CRANE_BODY_W) }}
      >
        {/* Painted first: the bracket must cover this canvas's pivot end. The
            mount constants put the boom's measured pivot exactly on the
            chassis's, at the solved k — see manifest _checks.b. */}
        {/* The FULL boom — head, barrel, lettering — is the SLIDING part. The
            ticker gives it rotate + an axial translate; every drawn detail
            travels together, so nothing can ever print twice. */}
        <div
          ref={boomHeadRef}
          className="absolute will-change-transform"
          style={{
            left: pct(BOOM_MOUNT.left),
            top: pct(BOOM_MOUNT.top),
            width: pct(BOOM_MOUNT.width),
            transformOrigin: BOOM_ORIGIN,
          }}
        >
          <img
            src={SPRITE.craneBoom.src}
            alt=""
            width={SPRITE.craneBoom.w}
            height={SPRITE.craneBoom.h}
            decoding="async"
            draggable={false}
            className="block h-auto w-full select-none"
          />
        </div>

        {/* The static SLEEVE — pivot plate, outer barrel, ram — drawn OVER the
            sliding boom: as the boom translates out along its axis, its tail
            disappears into this collar, which is how a telescope reads. */}
        <div
          ref={boomRef}
          className="absolute will-change-transform"
          style={{
            left: pct(BOOM_MOUNT.left),
            top: pct(BOOM_MOUNT.top),
            width: pct(BOOM_MOUNT.width),
            transformOrigin: BOOM_ORIGIN,
          }}
        >
          {/* Scaled about the pivot so the collar sits ~0.46·L up the axis —
              longer coverage than the drawn sleeve, so the sliding boom's
              tail never emerges from the back of the collar at full stroke.
              Static transform on the IMG: the wrapper's transform is owned by
              the ticker and would overwrite it. */}
          <img
            src={SPRITE.boomSleeve.src}
            alt=""
            width={SPRITE.craneBoom.w}
            height={SPRITE.craneBoom.h}
            decoding="async"
            draggable={false}
            className="block h-auto w-full select-none"
            style={{ transform: "scale(1.4)", transformOrigin: BOOM_ORIGIN }}
          />
        </div>

        <img
          src={SPRITE.craneBody.src}
          alt=""
          width={SPRITE.craneBody.w}
          height={SPRITE.craneBody.h}
          decoding="async"
          draggable={false}
          className="relative block h-auto w-full select-none"
        />

        {/* Live tyres on the measured hubs. The overlay is clipped to the tread
            circle because crane-wheel-cut's alpha keeps its baked ground
            shadow, which must not spin with the rim. */}
        {CRANE_WHEEL_PLACEMENTS.map((w, i) => (
          <img
            key={i}
            ref={wheelRefs[i]}
            src={SPRITE.craneWheel.src}
            alt=""
            width={SPRITE.craneWheel.w}
            height={SPRITE.craneWheel.h}
            decoding="async"
            draggable={false}
            className="absolute block h-auto select-none will-change-transform"
            style={{
              left: `${w.leftPct.toFixed(4)}%`,
              top: `${w.topPct.toFixed(4)}%`,
              width: `${w.widthPct.toFixed(4)}%`,
              transformOrigin: CRANE_WHEEL_ORIGIN,
              clipPath: CRANE_WHEEL_CLIP,
            }}
          />
        ))}
      </div>
    </div>
  );
}
