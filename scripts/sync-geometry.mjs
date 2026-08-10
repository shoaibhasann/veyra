import fs from "node:fs";

const root = "/Users/shoaib/veyra";
const m = JSON.parse(fs.readFileSync(`${root}/public/assets/manifest.json`, "utf8"));
const f = (n) => JSON.stringify(n);
const box = (b) => `{ x: ${f(b.x)}, y: ${f(b.y)}, w: ${f(b.w)}, h: ${f(b.h)} } as ContentBox`;
const wheels = m.truckSide.wheels
  .map((w) => `    { cx: ${f(w.cx)}, cy: ${f(w.cy)}, r: ${f(w.r)} },`)
  .join("\n");

const out = `/**
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
  w: ${m.truckSide.w},
  h: ${m.truckSide.h},
  contentBox: ${box(m.truckSide.contentBox)},
  wheels: [
${wheels}
  ] as WheelCircle[],
} as const;

/** The same vehicle from directly overhead (nadir), pointing right. */
export const TRUCK_TOP = {
  w: ${m.truckTop.w},
  h: ${m.truckTop.h},
  contentBox: ${box(m.truckTop.contentBox)},
} as const;

/** One truck wheel. cx/cy is the HUB centre; r is the mean tyre outer radius. */
export const WHEEL = {
  w: ${m.wheel.w},
  h: ${m.wheel.h},
  cx: ${f(m.wheel.cx)},
  cy: ${f(m.wheel.cy)},
  r: ${f(m.wheel.r)},
} as const;

/**
 * Reach stacker. spreaderTip is the centre of the spreader's load-bearing
 * underside — where a picked container's top-centre sits.
 */
export const REACH_STACKER = {
  w: ${m.reachStacker.w},
  h: ${m.reachStacker.h},
  contentBox: ${box(m.reachStacker.contentBox)},
  spreaderTip: { x: ${f(m.reachStacker.spreaderTip.x)}, y: ${f(m.reachStacker.spreaderTip.y)} },
} as const;

/**
 * 40ft container. container-cut.png / .webp has a broken alpha (the keyer ate the
 * corrugation highlights), so consumers crop container.webp to this box instead.
 */
export const CONTAINER = {
  w: ${m.container.w},
  h: ${m.container.h},
  contentBox: ${box(m.container.contentBox)},
} as const;
`;

fs.writeFileSync(`${root}/lib/assetGeometry.ts`, out);
console.log("wrote lib/assetGeometry.ts");
