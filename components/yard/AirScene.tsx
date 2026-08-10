/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";
import { TestimonialsBoard } from "@/components/sections/TestimonialsSection";

/**
 * THE AIR. No pasted skybox: the whiteout is BUILT from individual puff
 * sprites sailing in from BOTH wings of the frame, and the cover is their
 * DENSITY — the sea view survives in the gaps until the vapour wins. Then
 * the white freighter crosses left to right, dragging the next section in
 * behind its airframe: the reveal seam rides at PLANE_SEAM of the sprite,
 * hidden under the tail surfaces, which is why the aircraft is cut LARGER
 * than the viewport — the seam must be covered for the full height.
 *
 * Static markup only; the ticker owns every transform and opacity.
 */
export interface AirSceneRefs {
  /** The act root — visibility gated by the ticker. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** One handle per puff, in AIR_CLOUDS order. */
  cloudRefs: RefObject<HTMLDivElement | null>[];
  /** The towed daylight: the client section's own opening screen. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** The crossing freighter. */
  planeRef: RefObject<HTMLDivElement | null>;
}

/**
 * The weather, as a fleet. `side` is the wing it enters from (-1 left,
 * +1 right), `cx`/`y` its resting centre (viewport fractions), `w` the
 * sprite width (fraction of viewport width). Heavies hold the four
 * corners, two long bands cross the middle — together they take MOST of
 * the vessel's window without ever sealing it: the ship keeps breathing
 * through the gaps right up to the crossing.
 */
export const AIR_CLOUDS = [
  { src: "/assets/cloud-w2.webp", side: -1, cx: 0.34, y: 0.17, w: 0.78 },
  { src: "/assets/cloud-ca.webp", side: -1, cx: 0.14, y: 0.33, w: 0.52 },
  { src: "/assets/cloud-cb.webp", side: 1, cx: 0.86, y: 0.26, w: 0.54 },
  { src: "/assets/cloud-w1.webp", side: 1, cx: 0.66, y: 0.52, w: 0.66 },
  { src: "/assets/cloud-cd.webp", side: -1, cx: 0.19, y: 0.73, w: 0.52 },
  { src: "/assets/cloud-cb.webp", side: 1, cx: 0.82, y: 0.83, w: 0.56 },
  { src: "/assets/cloud-ce.webp", side: -1, cx: 0.47, y: 0.94, w: 0.5 },
] as const;

/**
 * The reveal seam's station inside the plane sprite, fraction of width —
 * the WING ROOT, not the tail. Solved off the sprite's own alpha: scanning
 * every column across the band the viewport actually shows (plus the bob's
 * margin), 0.4914 is the one place the airframe runs edge to edge with a
 * zero-pixel gap — upper wing, fuselage, lower wing as one unbroken
 * column. Anywhere else the daylight would show through a wing gap.
 */
export const PLANE_SEAM = 0.4914;

/** How much of the sprite is still on screen when the crossing ends: none.
    The freighter flies clean out the right and leaves the daylight. */
export const PLANE_EXIT = 0;

export default function AirScene({ rootRef, cloudRefs, panelRef, planeRef }: AirSceneRefs) {
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="invisible absolute inset-0 z-[2] overflow-hidden"
    >
      {/* The puff fleet — screen-blended, so only vapour prints. */}
      {AIR_CLOUDS.map((c, i) => (
        <div
          key={`${c.src}-${i}`}
          ref={cloudRefs[i]}
          className="absolute top-0 left-0 opacity-0 will-change-transform"
          style={{ width: `${(c.w * 100).toFixed(1)}vw` }}
        >
          <img
            src={c.src}
            alt=""
            decoding="async"
            draggable={false}
            className="block h-auto w-full select-none"
            style={{ filter: "brightness(1.06)" }}
          />
        </div>
      ))}

      {/* THE DRAGGED-IN SECTION — not a title card and not a blank
          rectangle: the client board itself, heading AND testimonials, the
          same component the real section renders. Viewport-fixed and
          revealed by a clip whose edge rides the freighter's wing root, so
          nothing slides and nothing has to line up: at pin release these
          are already the pixels the real section paints. */}
      <div
        ref={panelRef}
        className="absolute inset-0 overflow-hidden bg-[#FAF7F7] text-ink will-change-[clip-path]"
        style={{ clipPath: "inset(0 100% 0 0)" }}
      >
        <TestimonialsBoard />
      </div>

      {/* The freighter: cut LARGER than the frame so the seam behind it is
          covered edge to edge — the crossing is what the reveal hides in. */}
      <div
        ref={planeRef}
        className="absolute top-1/2 left-0 will-change-transform"
        style={{ width: "203svh", transform: "translate3d(-250vw, -50%, 0)" }}
      >
        <img
          src="/assets/plane-top.webp"
          alt=""
          decoding="async"
          draggable={false}
          className="block h-auto w-full select-none"
          style={{
            filter:
              "drop-shadow(-44px 54px 30px rgba(30, 48, 76, 0.35)) drop-shadow(0 0 2px rgba(255,255,255,0.4))",
          }}
        />
      </div>
    </div>
  );
}
