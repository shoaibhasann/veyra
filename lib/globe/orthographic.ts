import { Vector3 } from "three";
import { centerLongitude } from "./coords";

/**
 * Orthographic projection used by the globe's static (no-WebGL) fallback.
 *
 * Pure maths with no DOM access, so the SVG can be built at module scope and
 * rendered identically on the server and the client. Mirrors the WebGL scene's
 * rest orientation: spin about Y to frame a longitude, then a fixed Z tilt.
 */
export interface OrthoView {
  /** Longitude placed at the centre of the disc. */
  centerLng: number;
  /** Axial tilt in radians, applied after the spin. */
  tilt: number;
  cx: number;
  cy: number;
  radius: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Depth toward the viewer; > 0 is the near hemisphere. */
  z: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function projectOrtho(v: Vector3, view: OrthoView): ProjectedPoint {
  const a = centerLongitude(view.centerLng);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const x1 = v.x * ca + v.z * sa;
  const z1 = -v.x * sa + v.z * ca;

  const ct = Math.cos(view.tilt);
  const st = Math.sin(view.tilt);
  const x2 = x1 * ct - v.y * st;
  const y2 = x1 * st + v.y * ct;

  // Rounded to 2dp so server and client emit byte-identical path data
  // regardless of last-ULP differences between JS engines.
  return {
    x: round2(view.cx + x2 * view.radius),
    y: round2(view.cy - y2 * view.radius),
    z: z1,
  };
}

/**
 * Splits a polyline into SVG path runs covering only the near hemisphere.
 *
 * Where an edge crosses the silhouette the exact limb crossing is interpolated
 * and inserted, so runs terminate on the rim instead of snapping back to the
 * last vertex — coarse rings would otherwise leave visible notches.
 */
export function frontFacingRuns(
  points: readonly Vector3[],
  view: OrthoView,
  closed: boolean,
): string[] {
  const n = points.length;
  if (n < 2) return [];

  const runs: string[] = [];
  const scratch = new Vector3();
  let current = "";

  const append = (p: ProjectedPoint) => {
    current += `${current ? "L" : "M"}${p.x} ${p.y}`;
  };
  const flush = () => {
    if (current.includes("L")) runs.push(current);
    current = "";
  };

  // Walking a closed ring from index 0 would split a run that straddles the
  // array boundary into two, leaving a notch. Start on a back-facing vertex
  // so every front-facing run is contiguous; if there is none, the whole ring
  // is visible and can be emitted as a single closed subpath.
  let offset = 0;
  if (closed) {
    const firstBack = points.findIndex((p) => projectOrtho(p, view).z <= 0);
    if (firstBack === -1) {
      for (const p of points) append(projectOrtho(p, view));
      current += "Z";
      flush();
      return runs;
    }
    offset = firstBack;
  }

  const edges = closed ? n : n - 1;

  for (let i = 0; i < edges; i++) {
    const a = points[(offset + i) % n];
    const b = points[(offset + i + 1) % n];
    const pa = projectOrtho(a, view);
    const pb = projectOrtho(b, view);
    const aFront = pa.z > 0;

    if (aFront) append(pa);

    if (aFront !== pb.z > 0) {
      const t = pa.z / (pa.z - pb.z);
      append(projectOrtho(scratch.lerpVectors(a, b, t), view));
      if (aFront) flush();
    }
  }

  // An open polyline's final vertex is never an edge start, so add it here.
  if (!closed) {
    const last = projectOrtho(points[n - 1], view);
    if (last.z > 0) append(last);
  }
  flush();

  return runs;
}
