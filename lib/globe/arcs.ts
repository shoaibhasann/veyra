import { QuadraticBezierCurve3, Vector3 } from "three";
import {
  angularDistance,
  latLngToVector3,
  resolveRoutes,
  type City,
} from "./coords";

export interface ArcNetwork {
  /** LineSegments pairs — xyz triples, length = segments * 2 * 3 per arc */
  positions: Float32Array;
  /** 0..1 position along the parent arc, per vertex */
  progress: Float32Array;
  /** per-vertex copy of the parent arc's animation phase */
  phases: Float32Array;
  /** one curve per route, for CPU-side head tracking */
  curves: QuadraticBezierCurve3[];
  /** one phase per route, matching `curves` */
  headPhases: Float32Array;
  vertexCount: number;
}

export interface ArcOptions {
  radius?: number;
  segments?: number;
}

/**
 * Great-circle-ish arc between two coordinates.
 *
 * A quadratic Bezier's chord sags well inside the sphere on long hops, so the
 * control point is solved backwards from the apex we actually want:
 * apex = (chordMidpoint + control) / 2, therefore
 * control = 2 * apex - chordMidpoint. Lift scales with angular distance so a
 * Sydney-Melbourne hop stays low and a Shanghai-Sydney lane genuinely arcs.
 *
 * Peak altitude runs ~0.12R (short hops) to ~0.22R (antipodal-ish lanes), so
 * every route clearly flies ABOVE the surface and the longest ones bulge
 * outside the planet's silhouette before diving behind the limb.
 */
export function greatCircleArc(
  from: City,
  to: City,
  radius = 1,
): QuadraticBezierCurve3 {
  const start = latLngToVector3(from.lat, from.lng, radius);
  const end = latLngToVector3(to.lat, to.lng, radius);

  const angle = angularDistance(from, to);
  const lift = 0.12 + 0.1 * (angle / Math.PI);

  // Chord midpoint sits at radius * cos(angle / 2); push the control point out
  // along the surface normal far enough that the apex clears the sphere.
  const controlRadius = radius * (2 * (1 + lift) - Math.cos(angle / 2));
  const control = new Vector3()
    .addVectors(start, end)
    .normalize()
    .multiplyScalar(controlRadius);

  return new QuadraticBezierCurve3(start, control, end);
}

/** Flattens every route into one LineSegments buffer — a single draw call. */
export function buildArcNetwork(options: ArcOptions = {}): ArcNetwork {
  const { radius = 1, segments = 96 } = options;

  const routes = resolveRoutes();
  const curves = routes.map(({ from, to }) => greatCircleArc(from, to, radius));

  const perArcVerts = segments * 2;
  const vertexCount = curves.length * perArcVerts;

  const positions = new Float32Array(vertexCount * 3);
  const progress = new Float32Array(vertexCount);
  const phases = new Float32Array(vertexCount);
  const headPhases = new Float32Array(curves.length);

  let cursor = 0;

  curves.forEach((curve, arcIndex) => {
    // Irrational stride keeps the travelling heads from ever syncing up.
    const phase = (arcIndex * 0.6180339887) % 1;
    headPhases[arcIndex] = phase;

    const points = curve.getPoints(segments);
    for (let i = 0; i < segments; i++) {
      const a = points[i];
      const b = points[i + 1];

      positions[cursor * 3] = a.x;
      positions[cursor * 3 + 1] = a.y;
      positions[cursor * 3 + 2] = a.z;
      progress[cursor] = i / segments;
      phases[cursor] = phase;
      cursor++;

      positions[cursor * 3] = b.x;
      positions[cursor * 3 + 1] = b.y;
      positions[cursor * 3 + 2] = b.z;
      progress[cursor] = (i + 1) / segments;
      phases[cursor] = phase;
      cursor++;
    }
  });

  return { positions, progress, phases, curves, headPhases, vertexCount };
}

export interface MarkerField {
  positions: Float32Array;
  phases: Float32Array;
  count: number;
}

/** One pulsing marker per city, phase-offset so they never blink in unison. */
export function buildMarkerField(
  cities: readonly City[],
  radius = 1,
): MarkerField {
  const positions = new Float32Array(cities.length * 3);
  const phases = new Float32Array(cities.length);
  const v = new Vector3();

  cities.forEach((city, i) => {
    latLngToVector3(city.lat, city.lng, radius, v);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    phases[i] = (i * 0.3819660113) % 1;
  });

  return { positions, phases, count: cities.length };
}
