/**
 * The overhead junction, authored once as straights and circular arcs in units
 * of one truck length. The same description produces the SVG `d` strings that
 * are drawn, the hidden path the vehicle is sampled from, and the analytic
 * fallback used before that path is in the DOM — so the truck cannot drift off
 * the tarmac and nothing has to be measured from a screenshot.
 *
 * Screen convention: y grows downward, heading is degrees clockwise from +x,
 * and a positive `turn` steers clockwise (SVG's positive sweep direction).
 */

import { PATH_TRAVEL, clamp01, pathDistance } from "./geometry";

export interface RoadPoint {
  x: number;
  y: number;
  heading: number;
}

export type RoadSegment =
  | { kind: "line"; length: number }
  | { kind: "arc"; radius: number; turn: number };

interface BuiltSegment {
  length: number;
  start: RoadPoint;
  arc?: { cx: number; cy: number; a0: number; sweep: number; radius: number };
}

export interface RoadGeometry {
  totalLength: number;
  d: string;
  pointAt(distance: number): RoadPoint;
}

const DEG = Math.PI / 180;
const fmt = (n: number) => Number(n.toFixed(4));

export function buildRoad(start: RoadPoint, segments: RoadSegment[]): RoadGeometry {
  const built: BuiltSegment[] = [];
  let cur: RoadPoint = { ...start };
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  let totalLength = 0;

  for (const seg of segments) {
    if (seg.kind === "line") {
      const rad = cur.heading * DEG;
      built.push({ length: seg.length, start: cur });
      cur = {
        x: cur.x + Math.cos(rad) * seg.length,
        y: cur.y + Math.sin(rad) * seg.length,
        heading: cur.heading,
      };
      totalLength += seg.length;
      d += ` L ${fmt(cur.x)} ${fmt(cur.y)}`;
      continue;
    }

    const dir = seg.turn >= 0 ? 1 : -1;
    const toCentre = (cur.heading + 90 * dir) * DEG;
    const cx = cur.x + Math.cos(toCentre) * seg.radius;
    const cy = cur.y + Math.sin(toCentre) * seg.radius;
    const a0 = (cur.heading - 90 * dir) * DEG;
    const sweep = seg.turn * DEG;
    const length = Math.abs(sweep) * seg.radius;

    built.push({ length, start: cur, arc: { cx, cy, a0, sweep, radius: seg.radius } });
    cur = {
      x: cx + Math.cos(a0 + sweep) * seg.radius,
      y: cy + Math.sin(a0 + sweep) * seg.radius,
      heading: cur.heading + seg.turn,
    };
    totalLength += length;
    d +=
      ` A ${fmt(seg.radius)} ${fmt(seg.radius)} 0 ${Math.abs(seg.turn) > 180 ? 1 : 0}` +
      ` ${seg.turn >= 0 ? 1 : 0} ${fmt(cur.x)} ${fmt(cur.y)}`;
  }

  const end = cur;

  function pointAt(distance: number): RoadPoint {
    if (distance <= 0) {
      const rad = start.heading * DEG;
      return {
        x: start.x + Math.cos(rad) * distance,
        y: start.y + Math.sin(rad) * distance,
        heading: start.heading,
      };
    }

    let rem = distance;
    for (let i = 0; i < built.length; i++) {
      const seg = built[i];
      const last = i === built.length - 1;
      if (rem > seg.length && !last) {
        rem -= seg.length;
        continue;
      }
      if (!seg.arc) {
        const rad = seg.start.heading * DEG;
        return {
          x: seg.start.x + Math.cos(rad) * rem,
          y: seg.start.y + Math.sin(rad) * rem,
          heading: seg.start.heading,
        };
      }
      const f = rem / seg.length;
      const a = seg.arc.a0 + seg.arc.sweep * f;
      return {
        x: seg.arc.cx + Math.cos(a) * seg.arc.radius,
        y: seg.arc.cy + Math.sin(a) * seg.arc.radius,
        heading: seg.start.heading + (seg.arc.sweep / DEG) * f,
      };
    }
    return { ...end };
  }

  return { totalLength, d, pointAt };
}

/* --------------------------------------------------------------- junction -- */

/**
 * Junction centre, as a fraction of the stage box. Everything hangs off it.
 *
 * `y` clears the speed readout: the carriageway is half a road-width deep, and
 * at 0.30 the horizontal arm ran under the instrument's meter and odometer,
 * printing ink on tarmac. 0.38 puts the arm's top edge below the readout at
 * every desktop aspect while keeping the junction in the upper half of frame.
 */
export const JUNCTION = { x: 0.5, y: 0.38 };

/**
 * One road unit is one truck body length. Carriageway and vehicle both derive
 * their size from this single rule, measured off the same box, so the truck is
 * always the same share of its lane whatever the viewport. The svh term governs
 * from about 3:2 up; the vw term takes over on taller windows.
 */
const UNIT = { w: 0.205, h: 0.31 };
export const roadUnitPx = (w: number, h: number) => Math.min(UNIT.w * w, UNIT.h * h);

/** Carriageway width. The vehicle rides the CENTRELINE — one lane guide line
    runs either side of it, so band rows and road lines are the same picture. */
export const ROAD_WIDTH = 0.46;
/** Lane guide lines, offset from the centreline the truck drives. */
export const LANE_LINE_F = 0.275;
const LANE_LINE_OFF = ROAD_WIDTH * LANE_LINE_F;

const BEND_R = 1.3;
/** Drawn arms — long enough to leave frame at any aspect we render at. */
const DRAW = { west: 9, east: 9, south: 9 };
/** Travelled arms — trimmed so the run is mostly on camera, not off it. */
const TRAVEL = { west: 4.3, south: 3.9 };

/** In from the left, one 90 degree right-hander, out through the bottom. */
const route = (west: number, south: number, offset: number) =>
  buildRoad({ x: -west, y: -offset, heading: 0 }, [
    { kind: "line", length: west - BEND_R },
    { kind: "arc", radius: BEND_R + offset, turn: 90 },
    { kind: "line", length: south - BEND_R },
  ]);

const CENTRE = route(DRAW.west, DRAW.south, 0);

/** The truck's own line: dead on the centreline, exactly as the band drives. */
export const ROAD = route(TRAVEL.west, TRAVEL.south, 0);

/**
 * Asphalt. The two straight arms lay down the T and its square outer corner;
 * the filleted route rounds the inner corner so the left-to-down movement
 * reads as a bend rather than a right angle.
 */
export const CARRIAGEWAYS: string[] = [
  `M ${-DRAW.west} 0 L ${DRAW.east} 0`,
  `M 0 0 L 0 ${DRAW.south}`,
  CENTRE.d,
];

/**
 * Lane guide lines: one either side of the travelled centreline, through the
 * bend and along both straight arms — the continuation of the full-bleed
 * band's two dash rows, so the handoff frame is one unbroken picture.
 */
export const LANE_LINES: string[] = [
  route(DRAW.west, DRAW.south, LANE_LINE_OFF).d,
  route(DRAW.west, DRAW.south, -LANE_LINE_OFF).d,
  `M ${fmt(ROAD_WIDTH * 0.9)} ${fmt(-LANE_LINE_OFF)} L ${DRAW.east} ${fmt(-LANE_LINE_OFF)}`,
  `M ${fmt(ROAD_WIDTH * 0.9)} ${fmt(LANE_LINE_OFF)} L ${DRAW.east} ${fmt(LANE_LINE_OFF)}`,
];

/**
 * The merge island: nested chevrons in the wedge where the east arm leaves
 * the bend, pointing back into the join — the reference's hatched triangle.
 */
export const CHEVRONS: string[] = [0, 1, 2, 3].map((i) => {
  const x = 0.4 + i * 0.17;
  return `M ${fmt(x + 0.13)} 0.08 L ${fmt(x)} 0.26 L ${fmt(x + 0.13)} 0.44`;
});

/* ---------------------------------------------------------------- sampler -- */

export interface TravelSample {
  x: number;
  y: number;
  heading: number;
}

let travelEl: SVGPathElement | null = null;
let travelLen = 0;
/** Road units to CSS pixels, mirroring the transform RoadPath writes. */
let frame = { s: 1, x: 0, y: 0 };

export function registerTravelPath(el: SVGPathElement | null): void {
  travelEl = el && typeof el.getPointAtLength === "function" ? el : null;
  travelLen = travelEl?.getTotalLength() ?? 0;
}

export function setRoadFrame(s: number, x: number, y: number): void {
  frame = { s, x, y };
}

const RAD = 180 / Math.PI;
/** Tangent lookahead as a fraction of the route — short enough to hug the bend. */
const LOOKAHEAD = 0.004;

/**
 * Position and heading for `t` in 0..1, both read from the same hidden path so
 * the truck can never point somewhere it is not going. Falls back to the
 * analytic route until that path is mounted; the two agree by construction.
 */
export function sampleTravel(t: number): TravelSample {
  const u = clamp01(t);
  const el = travelEl;

  if (el && travelLen > 0) {
    const at = (d: number) => {
      const p = el.getPointAtLength(d < 0 ? 0 : d > travelLen ? travelLen : d);
      return { x: frame.x + p.x * frame.s, y: frame.y + p.y * frame.s };
    };
    const step = travelLen * LOOKAHEAD;
    const ahead = Math.min(u * travelLen + step, travelLen);
    const a = at(ahead - step);
    const b = at(ahead);
    const here = at(u * travelLen);
    return { x: here.x, y: here.y, heading: Math.atan2(b.y - a.y, b.x - a.x) * RAD };
  }

  const p = ROAD.pointAt(u * ROAD.totalLength);
  return { x: frame.x + p.x * frame.s, y: frame.y + p.y * frame.s, heading: p.heading };
}

/** Distance covered along the route in CSS pixels — the wheel driver's input. */
export const travelDistancePx = (t: number) =>
  clamp01(t) * (travelLen || ROAD.totalLength) * frame.s;

const PATH_ORIGIN = pathDistance(0);

/**
 * Timeline progress onto 0..1 of the route. Stated against `pathDistance` so
 * the overhead speed shape — its ease in, its dip, its final push — is the one
 * thing driving the run, with no second copy of the beat numbers here.
 */
export const travelUnit = (p: number) => clamp01((pathDistance(p) - PATH_ORIGIN) / PATH_TRAVEL);
