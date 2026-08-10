/**
 * Measured source geometry, mirrored from public/assets/manifest.json.
 *
 * public/assets/manifest.json stays the human-readable source of truth — it also
 * carries the measurement method and the confidence notes. This module is the
 * machine-readable half: numbers only, and it lives outside public/ so the app
 * never imports a module out of the static-asset directory and never bundles the
 * ~6 KB of prose that sits alongside the geometry.
 *
 * Units: every value is a fraction (0..1) of that image's OWN dimensions. x and
 * w are fractions of image width; y and h are fractions of image height. Radii
 * are fractions of image WIDTH. Regenerate with scripts/sync-geometry.mjs after
 * any re-measure.
 */

export interface ContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WheelCircle {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Side elevation, cab facing right. Wheels are ordered left to right: trailer
 * bogie x2, drive tandem x2, steer axle x1. The radii fall from 87.2px to 81.0px
 * across the set because the render carries a slight perspective — use the
 * per-wheel r for placement, never an average.
 */
export const TRUCK_SIDE = {
  w: 2688,
  h: 1536,
  contentBox: { x: 0.093006, y: 0.261719, w: 0.796503, h: 0.432292 } as ContentBox,
  wheels: [
    { cx: 0.170223, cy: 0.637266, r: 0.032426 },
    { cx: 0.245889, cy: 0.637839, r: 0.031726 },
    { cx: 0.511909, cy: 0.637702, r: 0.031432 },
    { cx: 0.588646, cy: 0.637786, r: 0.031012 },
    { cx: 0.821098, cy: 0.637376, r: 0.03013 },
  ] as WheelCircle[],
} as const;

/** The same vehicle from directly overhead (nadir), pointing right. */
export const TRUCK_TOP = {
  w: 2688,
  h: 1536,
  contentBox: { x: 0.063988, y: 0.365234, w: 0.864211, h: 0.273438 } as ContentBox,
} as const;

/** One truck wheel. cx/cy is the HUB centre; r is the mean tyre outer radius. */
export const WHEEL = {
  w: 2048,
  h: 2048,
  cx: 0.499849,
  cy: 0.500684,
  r: 0.313037,
} as const;

/**
 * Reach stacker. spreaderTip is the centre of the spreader's load-bearing
 * underside — where a picked container's top-centre sits.
 */
export const REACH_STACKER = {
  w: 2688,
  h: 1536,
  contentBox: { x: 0.298363, y: 0.123698, w: 0.546503, h: 0.76888 } as ContentBox,
  spreaderTip: { x: 0.74535, y: 0.347656 },
} as const;

/**
 * 40ft container. container-cut.png / .webp has a broken alpha (the keyer ate the
 * corrugation highlights), so consumers crop container.webp to this box instead.
 */
export const CONTAINER = {
  w: 2688,
  h: 1536,
  contentBox: { x: 0.089286, y: 0.217448, w: 0.819568, h: 0.55599 } as ContentBox,
} as const;
