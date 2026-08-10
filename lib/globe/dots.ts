import type { LandMask } from "./landmask";

export interface DotField {
  /** xyz triples, length = count * 3 */
  positions: Float32Array;
  /** per-dot 0..1 seed, drives shader shimmer offsets */
  seeds: Float32Array;
  count: number;
}

export interface DotFieldOptions {
  /**
   * Angular step of the equal-angle lat/lng grid, in degrees. One value for
   * both axes — rows are constant-latitude rings, columns a constant
   * longitude stride along each ring.
   */
  stepDeg?: number;
  /** Hard ceiling; excess dots are dropped by even stride. */
  maxDots?: number;
  radius?: number;
}

const DEG2RAD = Math.PI / 180;

/** Deterministic LCG — repeated mounts must produce an identical field. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Equal-angle lat/lng grid filtered through the land mask.
 *
 * The constant angular step aligns the dots in latitude rings — the
 * concentric arc rows the reference shows near the top limb — instead of the
 * old Fibonacci scatter. Alternate rows shift by half a longitude step so the
 * equator region doesn't moiré into hard vertical columns.
 *
 * The 1.1° default keeps ~12.5k land dots (Antarctica omitted) — roughly
 * half the old ~26.5k field, so the matrix reads as airy separated points
 * rather than a mesh. Still one draw call, well inside the instance budget;
 * `maxDots` is an emergency guard that the default step never trips.
 */
export function buildDotField(
  mask: LandMask,
  options: DotFieldOptions = {},
): DotField {
  const { stepDeg = 1.1, maxDots = 15000, radius = 1 } = options;

  const rows = Math.round(180 / stepDeg);
  const cols = Math.round(360 / stepDeg);
  const latStep = 180 / rows;
  const lngStep = 360 / cols;

  const kept: number[] = [];

  for (let row = 0; row < rows; row++) {
    const lat = -90 + (row + 0.5) * latStep;
    const lngOffset = row % 2 === 0 ? 0 : lngStep / 2;
    const latRad = lat * DEG2RAD;
    const cosLat = Math.cos(latRad);
    const y = Math.sin(latRad);

    for (let col = 0; col < cols; col++) {
      const lng = -180 + lngOffset + col * lngStep;
      if (!mask.isLand(lat, lng)) continue;

      const lngRad = lng * DEG2RAD;
      kept.push(cosLat * Math.sin(lngRad), y, cosLat * Math.cos(lngRad));
    }
  }

  const found = kept.length / 3;
  const stride = found > maxDots ? Math.ceil(found / maxDots) : 1;
  const count = Math.ceil(found / stride);

  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const random = lcg(0x5eed1);

  for (let out = 0, i = 0; i < found; i += stride, out++) {
    positions[out * 3] = kept[i * 3] * radius;
    positions[out * 3 + 1] = kept[i * 3 + 1] * radius;
    positions[out * 3 + 2] = kept[i * 3 + 2] * radius;
    seeds[out] = random();
  }

  return { positions, seeds, count };
}
