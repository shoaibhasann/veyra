import { WHEEL } from "@/lib/assetGeometry";

/**
 * The yard's constraint model. Everything here is a pure function of the single
 * scrubbed progress `p`, and nothing reads the DOM — the section measures one
 * box (the world) and multiplies.
 *
 * Two coordinate spaces:
 *  - SOURCE fractions, 0..1 of an asset's own canvas, straight out of
 *    public/assets/manifest.json.
 *  - WORLD fractions, 0..1 of the world box, which has a fixed 2688x1536 aspect.
 *    x is a fraction of world width, y of world height. A sprite drawn at world
 *    width `w` therefore has world height `w * WORLD_ASPECT / assetAspect`.
 *
 * The machine is no longer one still image. It is an articulated chain, and
 * every link's pose is derived from its parent IN THE SAME FRAME:
 *
 *   craneBody(p)                      translates along its lane, wheels rolling
 *     -> boomAngle(p)                 rotated about the measured pivot bolt
 *       -> boom head point            the pivot->head vector, re-aimed
 *         -> spreader                 hangs from the head, always horizontal,
 *                                     plus a vertical spreaderDrop(p) cable
 *           -> container              while locked, top-centre welded to the
 *                                     spreader's underside centre, exactly
 *
 * The container's pose is never authored. It is read off whichever parent
 * currently owns it — stack slot, spreader, trailer deck — evaluated at the
 * same `p` as that parent, so both contacts (spreader on roof, castings on
 * deck) are zero by construction at every scroll position, including a
 * reverse scrub.
 */

// ── Source geometry ───────────────────────────────────────────────────────────

export const WORLD = { w: 2688, h: 1536 } as const;
export const WORLD_ASPECT = WORLD.w / WORLD.h;

/**
 * The new-generation renders below are not in lib/assetGeometry (that module
 * predates the articulated set), so their measured fractions are mirrored here
 * from manifest.json, same as TRUCK_EMPTY always was.
 */
const TRUCK_EMPTY = {
  w: 2720,
  h: 1536,
  contentBox: { x: 0.09375, y: 0.270182, w: 0.795588, h: 0.423828 },
  wheels: [
    { cx: 0.169779, cy: 0.637695, r: 0.032169 },
    { cx: 0.245772, cy: 0.637695, r: 0.031801 },
    { cx: 0.511765, cy: 0.638021, r: 0.030882 },
    { cx: 0.588603, cy: 0.637891, r: 0.030588 },
    { cx: 0.82114, cy: 0.637695, r: 0.029228 },
  ],
  deck: { y: 0.547266, x0: 0.09375, x1: 0.590774 },
} as const;

/** Chassis only — no boom, no spreader. Pivot is the bracket's apex bolt. */
const CRANE_BODY = {
  w: 2720,
  h: 1536,
  contentBox: { x: 0.298897, y: 0.598307, w: 0.360294, h: 0.29362 },
  wheels: [
    { cx: 0.371507, cy: 0.822266, r: 0.039338 },
    { cx: 0.616544, cy: 0.819987, r: 0.040257 },
  ],
  groundY: 0.891927,
  pivot: { x: 0.323603, y: 0.644596 },
} as const;

/** The telescopic boom alone, drawn at its rest attitude. */
const CRANE_BOOM = {
  w: 2720,
  h: 1536,
  contentBox: { x: 0.153676, y: 0.125651, w: 0.672426, h: 0.765625 },
  pivot: { x: 0.185331, y: 0.751237 },
  head: { x: 0.791728, y: 0.345703 },
  restAngleDeg: 20.69,
  /** Pivot-to-head distance, as a fraction of the boom canvas WIDTH. */
  pivotToHeadLen: 0.648199,
} as const;

/** The hazard-striped beam. topHang is the lug the boom head carries. */
const SPREADER_SRC = {
  w: 2720,
  h: 1536,
  contentBox: { x: 0.126471, y: 0.377604, w: 0.75625, h: 0.209635 },
  topHang: { x: 0.492831, y: 0.431641 },
  gripY: 0.567708,
  feet: [
    { cx: 0.195404, bottomY: 0.586589 },
    { cx: 0.812316, bottomY: 0.584635 },
  ],
} as const;

/**
 * One crane wheel, dead on. cx/cy is the teal hub's centroid — NOT the canvas
 * centre — and the -cut alpha keeps the baked ground shadow, so the overlay is
 * clipped to the tyre circle instead of trusting the silhouette.
 */
const CRANE_WHEEL_SRC = { w: 2048, h: 2048, cx: 0.503677, cy: 0.563628, r: 0.374258 } as const;
/** Clip radius: between the measured tread r and its P95 — tyre in, shadow out. */
const CRANE_WHEEL_CLIP_R = 0.3775;

/** The long VEYRA container, side view. All planes measured, none guessed. */
const BOX_SRC = {
  w: 2720,
  h: 1536,
  contentBox: { x: 0.089338, y: 0.217448, w: 0.819485, h: 0.557943 },
  /** The flat top face the spreader's grip plane meets. */
  roofY: 0.228516,
  /** Underside of the bottom corner castings — the face that meets the deck. */
  castingsBottomY: 0.77474,
  topCastingCx: [0.10386, 0.894485],
} as const;

const DOOR_BLUE_SRC = {
  w: 1792,
  h: 2304,
  contentBox: { x: 0.093192, y: 0.142361, w: 0.813058, h: 0.679688 },
} as const;

const DOOR_ORANGE_SRC = {
  w: 1760,
  h: 2352,
  contentBox: { x: 0.092045, y: 0.140731, w: 0.817045, h: 0.682398 },
} as const;

/** Overhead empty trailer, and the deck rect the plan-view box drops onto. */
const TRUCK_TOP_SRC = {
  w: 2720,
  h: 1536,
  contentBox: { x: 0.063971, y: 0.364583, w: 0.864338, h: 0.274089 },
  deck: { x0: 0.063971, x1: 0.697794, y0: 0.393229, y1: 0.607422 },
} as const;

const CONTAINER_TOP_SRC = {
  w: 2688,
  h: 1536,
  contentBox: { x: 0.136161, y: 0.236328, w: 0.727307, h: 0.527344 },
} as const;

const TRUCK_GROUND = TRUCK_EMPTY.contentBox.y + TRUCK_EMPTY.contentBox.h;
const TRUCK_ASPECT = TRUCK_EMPTY.w / TRUCK_EMPTY.h;
/** Every articulated render sits on the same 2720x1536 canvas. */
const RIG_ASPECT = CRANE_BODY.w / CRANE_BODY.h;

const BOX_ASPECT =
  (BOX_SRC.contentBox.w * BOX_SRC.w) / (BOX_SRC.contentBox.h * BOX_SRC.h);

/** World height of a sprite drawn at world width `w`. */
const heightFor = (w: number, aspect: number) => (w * WORLD_ASPECT) / aspect;

// ── Stage framing ─────────────────────────────────────────────────────────────

/**
 * The stage is two numbers: how wide the world box is drawn, and where the
 * world's ground line lands in the pinned viewport. Everything below is a
 * fraction of that box, so the composition is one similarity transform away from
 * any viewport and needs no measured offset to survive a resize.
 */
export const STAGE = {
  /**
   * Pulled back from 142vw/236svh: at the old scale the machine's boom head
   * left the frame top on 16:10 displays and the body's tail clipped the left
   * edge. The whole working group must fit the picture, like the reference.
   */
  width: "min(124vw, 208svh)",
  /** Narrow screens hold the frozen pose; pull back so the loaded rig fits. */
  widthNarrow: "min(150vw, 208svh)",
  /** Ground line, as a fraction of the pinned viewport's height. */
  ground: 0.77,
} as const;

// ── Authored scale and depth ──────────────────────────────────────────────────

/** Truck canvas width, as a fraction of the world's. */
export const TRUCK_W = 0.65;
/** How much of the trailer's load span the container covers. */
const CONTAINER_FILL = 0.92;
/** Ground line the truck stands on. */
const GROUND_TRUCK = 0.855;

/**
 * The legacy machine's headline scale: at STAGE.width the 2688-canvas render
 * filled 62-65% of viewport height. crane-body IS that chassis re-rendered onto
 * a 2720 canvas with the same width-only stretch the trucks use (y identical,
 * x scaled by 2720/2688), so rendering the new canvas at LEGACY_MACHINE_W
 * scaled by that same ratio reproduces the proven stance px for px.
 */
const LEGACY_MACHINE_W = 0.622;
export const CRANE_BODY_W = LEGACY_MACHINE_W * (CRANE_BODY.w / WORLD.w);
export const CRANE_BODY_H = heightFor(CRANE_BODY_W, RIG_ASPECT);

/**
 * Boom canvas scale relative to the body canvas. The boom asset is drawn ~1.5x
 * larger than the body's world scale, so it is NEVER composed 1:1: at k the two
 * identical pivot plates coincide (manifest _checks.b, solved from the apex
 * bolt row; tunable in [0.66, 0.69]).
 */
const BOOM_K = 0.6615;
export const BOOM_W = BOOM_K * CRANE_BODY_W;
export const BOOM_H = heightFor(BOOM_W, RIG_ASPECT);

/**
 * The crane's lane — the FARTHEST from camera, per the reference: the machine
 * works from BEHIND the container row and behind the trailer it loads; its
 * boom reaches over the top of both, and any stance overlap with the stack
 * hides behind the doors instead of printing the machine on top of them.
 */
const GROUND_CRANE = 0.815;
/**
 * The stack's lane: one step upstage of the truck. Deep enough that a two-high
 * pile (door row + the pick box) towers over the chassis, which is what makes
 * the boom work steep like the reference; shallow enough that the descent onto
 * the roof and the lift back off it are both long, legible moves.
 */
const GROUND_STACK = 0.83;

/** Boom attitudes, degrees above horizontal. rest is the drawn pose. */
const THETA_REST = CRANE_BOOM.restAngleDeg;
/**
 * Working angle over the stack. 73° put the head above the frame top on
 * 16:10 displays (the user's screenshots show the spreader floating with the
 * boom cut off) — 66° keeps the whole machine inside the picture at every
 * common aspect, which matters more than the steeper reference stance.
 */
const THETA_PICK = 60;
/**
 * Carry attitude: modestly above the lift pose. Defined as an offset from the
 * height-solved THETA_LIFT (declared later, so this is a getter-style const
 * computed where the solves exist — see THETA_CARRY_SOLVED below).
 */
/** Boom-down attitude at the trailer; the cable supplies the last reach. */
const DROP_PLACE = 0.012;
/** Spreader cable states, in world-height fractions. rest = docked. */
const DROP_REST = 0.006;
const DROP_CARRY = 0.008;

// ── Derived world geometry ────────────────────────────────────────────────────

export const TRUCK_H = heightFor(TRUCK_W, TRUCK_ASPECT);
/** Truck canvas top. Constant: the truck only ever moves horizontally. */
export const TRUCK_TOP_Y = GROUND_TRUCK - TRUCK_GROUND * TRUCK_H;
/** The plane a container's bottom castings rest on. */
const DECK_Y = TRUCK_TOP_Y + TRUCK_EMPTY.deck.y * TRUCK_H;
const DECK_CX = (TRUCK_EMPTY.deck.x0 + TRUCK_EMPTY.deck.x1) / 2;

export const BOX_W = CONTAINER_FILL * (TRUCK_EMPTY.deck.x1 - TRUCK_EMPTY.deck.x0) * TRUCK_W;
export const BOX_H = heightFor(BOX_W, BOX_ASPECT);

/**
 * The container as a rigid body. The wrapper is the measured content box; the
 * three planes the story touches live at fixed offsets inside it.
 */
const BOX_CB = BOX_SRC.contentBox;
/** Wrapper top -> roof contact plane (the spreader's grip lands here). */
const BOX_ROOF_DY = ((BOX_SRC.roofY - BOX_CB.y) / BOX_CB.h) * BOX_H;
/** Wrapper top -> casting underside (this face meets deck and stack). */
const BOX_BOTTOM_DY = ((BOX_SRC.castingsBottomY - BOX_CB.y) / BOX_CB.h) * BOX_H;
/** Wrapper left -> top-casting centre — what the twistlocks centre on. */
const BOX_CAST_DX =
  (((BOX_SRC.topCastingCx[0] + BOX_SRC.topCastingCx[1]) / 2 - BOX_CB.x) / BOX_CB.w) * BOX_W;
/** Roof plane -> casting plane: the box's structural height. */
const BOX_GRIP_TO_BOTTOM = BOX_BOTTOM_DY - BOX_ROOF_DY;

/**
 * Spreader scale is solved, not styled: rendered so its twist-lock feet span
 * exactly the container's top-casting span. That single equality is what makes
 * the lock read — the feet land ON the castings, at any viewport.
 */
const CAST_SPAN_W =
  ((BOX_SRC.topCastingCx[1] - BOX_SRC.topCastingCx[0]) / BOX_CB.w) * BOX_W;
const FEET_SPAN_F = SPREADER_SRC.feet[1].cx - SPREADER_SRC.feet[0].cx;
export const SPREADER_W = CAST_SPAN_W / FEET_SPAN_F;
export const SPREADER_H = heightFor(SPREADER_W, RIG_ASPECT);

const SP_HANG_DX = SPREADER_SRC.topHang.x * SPREADER_W;
const SP_HANG_DY = SPREADER_SRC.topHang.y * SPREADER_H;
/**
 * Contact plane = the twistlock FEET's undersides, not the beam's. The feet
 * hang ~2% of the sprite below the beam face; welding the beam face to the
 * roof sank the feet visibly INTO the container. Feet on the castings is
 * also what the real machine does.
 */
const SP_GRIP_DY =
  ((SPREADER_SRC.feet[0].bottomY + SPREADER_SRC.feet[1].bottomY) / 2) * SPREADER_H;
const SP_FEET_CX =
  ((SPREADER_SRC.feet[0].cx + SPREADER_SRC.feet[1].cx) / 2) * SPREADER_W;
/** Hang lug -> grip plane, and hang lug -> feet centre. The whole hang, really. */
const HANG_TO_GRIP = SP_GRIP_DY - SP_HANG_DY;
const HANG_TO_FEET_CX = SP_FEET_CX - SP_HANG_DX;
export const GRIP_SPAN_W = FEET_SPAN_F * SPREADER_W;

/** Body-frame offsets. The body's y never changes — the machine stays planted. */
const BODY_PIVOT_DX = CRANE_BODY.pivot.x * CRANE_BODY_W;
const BODY_PIVOT_DY = CRANE_BODY.pivot.y * CRANE_BODY_H;
const CRANE_BODY_Y = GROUND_CRANE - CRANE_BODY.groundY * CRANE_BODY_H;
const PIVOT_Y = CRANE_BODY_Y + BODY_PIVOT_DY;

/**
 * Boom reach, in UNIFORM units (world-height fractions on both axes; x
 * converts through WORLD_ASPECT). Rotation is only angle-preserving in a
 * square metric, which world fractions are not — this is the one place the
 * file leaves them, and both axes come straight back.
 */
const BOOM_LEN_U = CRANE_BOOM.pivotToHeadLen * BOOM_W * WORLD_ASPECT;
const RAD = Math.PI / 180;

/** Head height for a boom angle. The head's x rides the authored grip track. */
const headYFor = (thetaDeg: number, extU = 0) =>
  PIVOT_Y - (BOOM_LEN_U + extU) * Math.sin(thetaDeg * RAD);

/**
 * Boom mount inside the body wrapper, in fractions of the body canvas: scale
 * the boom canvas by k, then put its pivot fraction exactly on the body's.
 * Same-aspect canvases make the k identical on both axes.
 */
export const BOOM_MOUNT = {
  left: CRANE_BODY.pivot.x - CRANE_BOOM.pivot.x * BOOM_K,
  top: CRANE_BODY.pivot.y - CRANE_BOOM.pivot.y * BOOM_K,
  width: BOOM_K,
} as const;
export const BOOM_ORIGIN = `${(CRANE_BOOM.pivot.x * 100).toFixed(4)}% ${(CRANE_BOOM.pivot.y * 100).toFixed(4)}%`;

export const GROUND = {
  truck: GROUND_TRUCK,
  crane: GROUND_CRANE,
  stack: GROUND_STACK,
} as const;

/**
 * Depth order, solved rather than asserted by DOM order. The machine's lane is
 * authored downstage of the truck's, so it draws in FRONT — which is what stops
 * it reading as standing inside the skeletal trailer.
 */
/**
 * Depth order, near to far: spreader (11/12) > box > truck > stack > crane.
 * The machine is the FAR lane — the reference's arm reaches over the row from
 * behind, the trailer rolls in front of the chassis at the place, and the
 * carried box always occludes the boom. Explicit constants now; the old
 * ground-line ternary described the abandoned near-lane staging.
 */
export const LAYER = {
  crane: 1,
  stack: 2,
  truck: 3,
  box: 4,
} as const;

/**
 * Ground shadow under the truck, in the truck canvas's own fractions — so a
 * percentage of the rig wrapper puts it on the measured ground line and it
 * travels with the vehicle for free.
 */
export const TRUCK_SHADOW = {
  left: TRUCK_EMPTY.contentBox.x - 0.02,
  width: TRUCK_EMPTY.contentBox.w + 0.04,
  height: 0.024,
  top: TRUCK_GROUND - 0.012,
} as const;

/** Machine's contact patch: centred under the chassis content box. */
export const CRANE_SHADOW = {
  cx: (CRANE_BODY.contentBox.x + CRANE_BODY.contentBox.w / 2) * CRANE_BODY_W,
  width: CRANE_BODY_W * 0.34,
} as const;

// ── Beats ─────────────────────────────────────────────────────────────────────

/**
 * Beats overlap on purpose. Two adjacent beats that merely abut leave a frame
 * where the outgoing move has finished and the incoming one has not started —
 * scrubbed, that is dead air, and dead air is what reads as the story happening
 * "in different sections". The rule every boundary below satisfies: there is no
 * window of p in which nothing on stage is moving, except the one authored
 * stop while the spreader takes the weight.
 *
 * Ordering is the whole fix for the "ocean-like dark section": the machine is
 * fully off stage at `clear`, the truck does not roll until `depart`, and
 * SplitStage states its own `in` from BEAT.depart — so the black floor can only
 * ever rise as part of the departure, never mid-story.
 */
export const BEAT = {
  /** Entry leg ends; the machine keeps trimming in while the boom goes up. */
  yard: 0.06,
  /** Boom starts raising, still on approach — overlap, not sequence. */
  raise: 0.055,
  /** Boom at the working angle; the spreader now clears the stack top. */
  hover: 0.145,
  /** Winch starts paying out — overlaps the last of the lateral glide. */
  descend: 0.185,
  /** Feet-centre parked exactly over the castings. */
  mark: 0.19,
  /** TOUCH. Grip plane meets roof plane, 0px, and the twistlocks seat. */
  pick: 0.25,
  /** End of the one deliberate stop — the spreader has taken the weight. */
  weigh: 0.265,
  /** Box at carry height, docked under the head. */
  lift: 0.335,
  /** Body starts back toward the truck, load held high. */
  travel: 0.31,
  truckIn: 0.29,
  truckStop: 0.43,
  /** Boom starts down over the parked trailer. */
  place: 0.44,
  /** Castings meet the deck. 0px, same-frame chain. */
  placeTouch: 0.545,
  /** Locks open; the winch reels the spreader up off the roof. */
  release: 0.565,
  /** Body starts off stage — the spreader is already clear of the box. */
  exit: 0.585,
  /** Machine fully off stage. Nothing of the rig may be visible past here. */
  clear: 0.645,
  /** The truck rolls. SplitStage's seam is stated from this constant. */
  depart: 0.66,
  camOut: 0.8,
  topIn: 0.82,
  run: 0.94,
} as const;

/**
 * THE FOLLOW. From BEAT.depart the camera stops being a tripod: it pulls back
 * while the machine is still leaving, locks onto the loaded truck, and from
 * then on the WORLD streams past the vehicle instead of the vehicle leaving
 * the frame — the truck can never clip the edge, because its screen position
 * is pinned by construction. The services strip (ghost type on the paper band,
 * cards on the night band) rides the same distance-driven parameter, so the
 * roadside furniture and the tyres can never disagree about speed.
 */
export const DRIVE = {
  /** Camera starts pulling back — overlaps the machine's exit, per the ref. */
  zoomIn: 0.6,
  /** Pull-back complete; the lens is now welded to the truck. */
  zoomOut: 0.72,
  /** World scale at full pull-back. */
  scale: 0.7,
  /** Ground line during the follow, as a fraction of the viewport height. */
  ground: 0.44,
  /** Where the truck's content centre rides on screen, viewport fraction. */
  truckX: 0.36,
  /** Total distance driven during the follow, in world widths. */
  units: 3.0,
} as const;

/**
 * Frozen pose for reduced motion and small screens: the loaded truck parked,
 * the machine already off stage, the seam not yet risen — the static frames
 * paint their own paper/night split, so they only need the pose.
 */
export const STATIC_P = 0.652;

// ── Easing ────────────────────────────────────────────────────────────────────

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** 0..1 ramp across [a, b]; a zero-width window degrades to a step. */
export function span(p: number, a: number, b: number): number {
  return b > a ? clamp01((p - a) / (b - a)) : p >= b ? 1 : 0;
}

const linear = (t: number) => t;
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const inQuad = (t: number) => t * t;
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/**
 * Quadratic in-out. Its slope falls off linearly rather than quadratically, so
 * it leaves and arrives with real residual speed where a cubic is already flat.
 */
const inOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A keyframe track: piecewise interpolation with a per-segment ease. Position
 * curves are authored this way so a single lookup gives both the value and,
 * by finite difference, the speed the readout shows.
 */
type Key = [at: number, value: number, ease?: (t: number) => number];

function track(keys: Key[], p: number): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [at, value, ease] = keys[i];
    if (p <= at) {
      const [prevAt, prevValue] = keys[i - 1];
      const t = at === prevAt ? 1 : (p - prevAt) / (at - prevAt);
      return lerp(prevValue, value, (ease ?? inOut)(t));
    }
  }
  return keys[keys.length - 1][1];
}

// ── Solved contact constants ──────────────────────────────────────────────────

/**
 * Both framings are solved, not eyeballed. At the pick the group is the
 * machine's whole silhouette plus the stack; its half-width either side of the
 * grip is known, so subtracting it from the world's centreline centres the
 * group with equal air at every viewport.
 */
const REACH_AT = (thetaDeg: number) =>
  HANG_TO_FEET_CX + BODY_PIVOT_DX + (BOOM_LEN_U * Math.cos(thetaDeg * RAD)) / WORLD_ASPECT;
const CRANE_REACH_L =
  REACH_AT(THETA_PICK) - CRANE_BODY.contentBox.x * CRANE_BODY_W;
const STACK_REACH_R = BOX_W - BOX_CAST_DX;
/**
 * The stack lives on the RIGHT of the frame like the reference stills — the
 * machine enters from the left and works toward it. Anchored by the stack's
 * right edge in world space (0.5 is screen centre; the stage overflows the
 * viewport, so ~0.84 lands the row near the right margin on a 16:9 screen).
 */
const STACK_RIGHT = 0.86;
const PICK_X = STACK_RIGHT - STACK_REACH_R;

/**
 * Where the deck centre parks: the mark that centres the truck's own content
 * box, so the loaded rig fills the frame at the drop.
 */
const TRUCK_BODY_CX = TRUCK_EMPTY.contentBox.x + TRUCK_EMPTY.contentBox.w / 2;
const PARK_DECK_X = 0.5 - (TRUCK_BODY_CX - DECK_CX) * TRUCK_W;

/**
 * Where the box waits while the trailer reverses in under it: just aft of the
 * deck centre, a clear half-box of daylight from the tractor's cab.
 */
const CLEAR_X = PARK_DECK_X - 0.105 * BOX_W;

/**
 * Off-stage marks, in grip x. The spreader's nose leads the machine by
 * ~0.176 world, and on an ultrawide stage the visible frame starts at world
 * x ~0.006 — these clear that plus margin.
 */
const GRIP_ENTER_X = -0.22;
const GRIP_EXIT_X = -0.3;

const TRUCK_PARK = PARK_DECK_X - DECK_CX * TRUCK_W;
const TRUCK_ENTER = 1.3;

/**
 * The stack, per the reference stills: two 40ft door faces side by side —
 * navy and rust — with the long white VEYRA box lying across the top. Door
 * CONTENT height equals the box's structural height (they are the same
 * container family), so the row's top face is where the pick box rests.
 */
const DOOR_GAP = 0.005;
const doorW = (src: { w: number; h: number; contentBox: { w: number; h: number } }) =>
  (BOX_H * ((src.contentBox.w * src.w) / (src.contentBox.h * src.h))) / WORLD_ASPECT;
const DOOR_BLUE_W = doorW(DOOR_BLUE_SRC);
const DOOR_ORANGE_W = doorW(DOOR_ORANGE_SRC);
const ROW_W = DOOR_BLUE_W + DOOR_GAP + DOOR_ORANGE_W;
const ROW_TOP = GROUND_STACK - BOX_H;

/** The slot the hero box starts in: castings on the door row's top face. */
const PICK_SLOT = { x: PICK_X - BOX_CAST_DX, y: ROW_TOP - BOX_BOTTOM_DY } as const;
/** The roof plane of the stacked box — THE pick contact. */
const STACK_ROOF_Y = PICK_SLOT.y + BOX_ROOF_DY;

/** The grip plane's height when the box is standing on the deck. */
const GRIP_AT_DECK_Y = DECK_Y - BOX_GRIP_TO_BOTTOM;

/**
 * The two solved cable lengths. Author the angle, solve the drop (pick) — and
 * author the drop, solve the angle (place). Solving one of each pair is what
 * turns both contacts into equalities instead of tuned offsets.
 */
/**
 * THE PARK BRAKE. Deriving the chassis from the boom angle alone made the
 * machine WALK INTO THE STACK as the boom steepened (reach shrinks with the
 * angle, so the body crept forward to keep the head over the box). The real
 * machine parks and TELESCOPES instead. So: the body may never advance past
 * this mark — its front stays a margin left of the door row — and whatever
 * reach the parked stance can't supply at the current angle, the barrel
 * stroke does. The stroke is SOLVED per frame from that clamp, so the grip
 * welds are untouched and reverse scrub replays exactly.
 */
const ROW_LEFT = PICK_SLOT.x + BOX_W / 2 - ROW_W / 2;
const BODY_CONTENT_L_OFF = CRANE_BODY.contentBox.x * CRANE_BODY_W;
const BODY_CONTENT_W = CRANE_BODY.contentBox.w * CRANE_BODY_W;
/**
 * Chassis canvas-corner x when parked: content front near the row edge (the
 * reference machine stands close). A tight margin keeps the required barrel
 * stroke inside the sleeve's coverage.
 */
const BODY_PARK_X = ROW_LEFT - 0.008 - BODY_CONTENT_L_OFF - BODY_CONTENT_W;
/**
 * Stroke ceiling = the sleeve's coverage. The scaled sleeve collar sits
 * ~0.46·L up the axis; the sliding boom's tail must stay inside it, or the
 * barrel visibly detaches ("hawa mein"). If a stance ever needs more than
 * this, cranePose gracefully lets the chassis creep the remainder instead —
 * the welds never break either way.
 */
const EXT_MAX = 0.42 * BOOM_LEN_U;
const THETA_PLACE =
  Math.asin((PIVOT_Y + HANG_TO_GRIP + DROP_PLACE - GRIP_AT_DECK_Y) / BOOM_LEN_U) / RAD;
/**
 * RIGID PICK — the reference machine has no winch. The spreader is bolted to
 * the boom head, and the whole boom LUFFS DOWN until the grip plane meets the
 * stacked box's roof: the same solve as the deck placement, aimed at the
 * stack. The chassis creeps by exactly the reach change (cranePose derives
 * from this angle), which is how the real machine does it.
 */
/**
 * Under the park clamp the pick kinematics change: (L+ext)·cosθ is pinned to
 * the parked horizontal reach C, so the grip height varies with tanθ and the
 * touch angle is an atan, not an asin. H and C are both in boom-length units.
 */
const TOUCH_C =
  (PICK_X - HANG_TO_FEET_CX - BODY_PIVOT_DX - BODY_PARK_X) * WORLD_ASPECT;
const THETA_TOUCH =
  Math.atan2(PIVOT_Y + HANG_TO_GRIP + DROP_REST - STACK_ROOF_Y, TOUCH_C) / RAD;
/**
 * Under the clamp the grip height goes with tanθ, so fixed +N° offsets that
 * felt gentle under sinθ launch the box off the top of the frame. Solve the
 * working attitudes from TARGET HEIGHTS instead, through the same atan.
 */
const gripThetaFor = (gripY: number) =>
  Math.atan2(PIVOT_Y + HANG_TO_GRIP + DROP_REST - gripY, TOUCH_C) / RAD;
/**
 * Approach attitude: a full 0.85 box of daylight over the roof — the spreader
 * must READ as hovering before the luff, never as resting on the load.
 */
const THETA_HOVER = gripThetaFor(STACK_ROOF_Y - 0.85 * BOX_H);
/** Post-lock attitude: half a box of clear air — visibly lifted, in frame. */
const THETA_LIFT = gripThetaFor(STACK_ROOF_Y - 0.5 * BOX_H);
/**
 * Carry attitude: the box rides a whole box-height above the stack — the
 * highest pose of the cycle, still safely inside the frame because it is a
 * height solve, not an angle guess.
 */
const THETA_CARRY = gripThetaFor(STACK_ROOF_Y - 1.0 * BOX_H);
/** Exit attitude: spreader up, well clear of the placed box, driving away. */
const THETA_EXIT = 52;

/** Row centred under the pick box's visual centre. */
const ROW_CX = PICK_SLOT.x + BOX_W / 2;

export const DOOR_SLOTS = [
  {
    key: "blue" as const,
    x: ROW_CX - ROW_W / 2,
    y: ROW_TOP,
    w: DOOR_BLUE_W,
    h: BOX_H,
  },
  {
    key: "orange" as const,
    x: ROW_CX - ROW_W / 2 + DOOR_BLUE_W + DOOR_GAP,
    y: ROW_TOP,
    w: DOOR_ORANGE_W,
    h: BOX_H,
  },
] as const;

export const STACK_SHADOW = {
  x: ROW_CX - (ROW_W * 1.18) / 2,
  y: GROUND_STACK - 0.011,
  w: ROW_W * 1.18,
  h: 0.022,
} as const;

// ── Motion tracks ─────────────────────────────────────────────────────────────

/**
 * Grip x — the spreader's feet-centre, which is also the casting centre of
 * whatever it holds. Authoring the contact point directly is what lets the pick
 * and the drop be stated as equalities; the BODY's x is derived from this and
 * the boom angle in the same frame, so the chassis creeps forward on its tyres
 * as the boom steepens, exactly like the real machine.
 */
const GRIP_X: Key[] = [
  [0, GRIP_ENTER_X],
  // Linear, not eased: an ease that lands on zero slope here would hand over to
  // the creep through a frame where the machine is stopped for no reason.
  [BEAT.yard, PICK_X - 0.4, linear],
  // Hold short of the stack while the boom goes up: the spreader's nose may
  // only cross the box's face once the beam is above the roof line.
  [0.1, PICK_X - 0.4],
  [BEAT.mark, PICK_X],
  // The stop while the locks seat, then the carry back toward the trailer.
  [BEAT.travel, PICK_X],
  [BEAT.truckStop, CLEAR_X],
  /**
   * The trim onto the deck mark rides INSIDE the boom-down move and ends
   * before the touch, so the last centimetre of the placement is vertical.
   * Quadratic, so it arrives with residual speed instead of parking early.
   */
  [0.535, PARK_DECK_X, inOutQuad],
  [BEAT.exit, PARK_DECK_X],
  // One accelerating leg, all the way off stage — a machine pulling away.
  [BEAT.clear, GRIP_EXIT_X, inQuad],
];

/** Boom attitude. Angles above horizontal; contacts are solved at the keys. */
const BOOM_KEYS: Key[] = [
  [0, THETA_REST],
  [BEAT.raise, THETA_REST],
  // Approach: head parks over the box, spreader a clear gap above the roof.
  // The hover HOLDS past the arrival mark (0.19) so the high pose registers
  // before anything moves down — no more touching-on-arrival read.
  [BEAT.hover, THETA_HOVER],
  [0.21, THETA_HOVER],
  // THE LUFF. The whole boom lowers the rigid spreader onto the roof — no
  // cable — and the chassis creeps by the reach change, like the real machine.
  [BEAT.pick, THETA_TOUCH, smoother],
  [BEAT.weigh, THETA_TOUCH],
  // The boom lifts the box into clear air and holds it low through the first
  // stretch of the reverse; the carry attitude only comes mid-travel — the
  // "angle change" beat.
  [0.315, THETA_LIFT, outCubic],
  [0.33, THETA_LIFT],
  [0.42, THETA_CARRY, smoother],
  [BEAT.place, THETA_CARRY],
  [BEAT.placeTouch, THETA_PLACE],
  [BEAT.release, THETA_PLACE],
  [BEAT.clear, THETA_EXIT],
];

/**
 * Cable pay-out. The two contact values are the solved constants above, so the
 * track LANDS on the equalities rather than aiming near them. The reel-in after
 * release leads with speed (outCubic) so the spreader is clear of the roof
 * before the body starts moving at BEAT.exit.
 */
// No winch on a reach stacker: the spreader stays docked at the head for the
// whole cycle. The only excursion is a barely-visible settle at the deck
// placement, short enough that the cable line never renders.
const DROP_KEYS: Key[] = [
  [0, DROP_REST],
  [BEAT.place, DROP_REST],
  [BEAT.placeTouch, DROP_PLACE],
  [BEAT.release, DROP_PLACE],
  [0.635, DROP_REST, outCubic],
];

const TRUCK_X: Key[] = [
  [BEAT.truckIn, TRUCK_ENTER],
  [BEAT.truckStop, TRUCK_PARK, smoother],
  [BEAT.depart, TRUCK_PARK],
  // Roll-out: a quadratic launch whose end slope (~10 units/p) matches the
  // cruise leg's constant slope, so the hand-off into the run has no kink.
  // The truck NEVER exits — the camera is following it from DRIVE.zoomOut on,
  // and the world does the leaving instead.
  [0.73, TRUCK_PARK + 0.35, inQuad],
  [0.985, TRUCK_PARK + DRIVE.units, linear],
  [1, TRUCK_PARK + DRIVE.units],
];

export const gripXAt = (p: number) => track(GRIP_X, p);
/**
 * Barrel stroke, world units along the boom axis. Extends over the stack
 * BEFORE the cable pays out (the glide the user asked for), holds through the
 * pick and the clear-air lift, and reels back in during the pull-back as the
 * boom swings up to carry — zero everywhere else, so the place solve and the
 * exit pose are untouched.
 */
export const boomAngleAt = (p: number) => track(BOOM_KEYS, p);

/**
 * SOLVED telescope stroke — not a keyframe track. Whenever keeping the grip
 * over its mark would need the parked chassis to creep past BODY_PARK_X, the
 * difference comes out of the barrel instead. Gated to the stack's
 * neighbourhood so the deck-placement solve (which assumes zero stroke)
 * stays exact.
 */
export function boomExtAt(p: number): number {
  if (gripXAt(p) < PICK_X - 0.15) return 0;
  const theta = boomAngleAt(p);
  const need =
    ((gripXAt(p) - HANG_TO_FEET_CX - BODY_PIVOT_DX - BODY_PARK_X) * WORLD_ASPECT) /
      Math.cos(theta * RAD) -
    BOOM_LEN_U;
  return Math.min(EXT_MAX, Math.max(0, need));
}
/** Stroke as a fraction of the drawn pivot→head length — the render's unit. */
export const boomExtRatioAt = (p: number) => boomExtAt(p) / BOOM_LEN_U;
/** Drawn boom axis, in the sprite's own width/height fractions. */
export const BOOM_EXT_AXIS = {
  x: CRANE_BOOM.head.x - CRANE_BOOM.pivot.x,
  y: CRANE_BOOM.head.y - CRANE_BOOM.pivot.y,
} as const;
export const spreaderDropAt = (p: number) => track(DROP_KEYS, p);
export const truckXAt = (p: number) => track(TRUCK_X, p);

/**
 * Distance driven since the park, normalised to the follow's full run. THE
 * drive parameter: the strip, the ghost type, the odometer and the pill all
 * state their motion from this one number, which is itself the truck's own x
 * — so nothing roadside can move while the truck is stood still.
 */
export const driveT = (p: number) =>
  // Hard zero before the departure: the x-track returns TRUCK_ENTER (off
  // frame right) ahead of its first key, which would otherwise read as a
  // third of the drive already covered — parking the roadside strip half-way
  // on stage through the whole yard story.
  p < BEAT.depart ? 0 : clamp01((truckXAt(p) - TRUCK_PARK) / DRIVE.units);

/** Truck content-box centre in world units — the point the camera locks to. */
export const truckFollowCx = (p: number) => truckXAt(p) + TRUCK_BODY_CX * TRUCK_W;

/** CSS rotation for the boom wrapper: positive is clockwise, rest is 0. */
export const boomRotationAt = (p: number) => THETA_REST - boomAngleAt(p);

// ── Poses ─────────────────────────────────────────────────────────────────────

export interface Pose {
  /** World x/y of the sprite's own top-left corner. */
  x: number;
  y: number;
}

/** Boom head, in world fractions — the point the spreader hangs from. */
export function boomHeadPose(p: number): Pose {
  const theta = boomAngleAt(p);
  const headX = gripXAt(p) - HANG_TO_FEET_CX;
  return { x: headX, y: headYFor(theta, boomExtAt(p)) };
}

/**
 * Crane body canvas corner. x is derived from the grip track back through the
 * boom in the same frame — so as the boom steepens over a fixed grip mark, the
 * chassis creeps forward on its tyres, and the tyres roll by exactly that much.
 */
export function cranePose(p: number): Pose {
  const theta = boomAngleAt(p);
  const headX = gripXAt(p) - HANG_TO_FEET_CX;
  return {
    x:
      headX -
      ((BOOM_LEN_U + boomExtAt(p)) * Math.cos(theta * RAD)) / WORLD_ASPECT -
      BODY_PIVOT_DX,
    y: CRANE_BODY_Y,
  };
}

/** Spreader canvas corner: hangs from the head, plus the cable's drop. */
export function spreaderPose(p: number): Pose {
  const head = boomHeadPose(p);
  return {
    x: head.x - SP_HANG_DX,
    y: head.y - SP_HANG_DY + spreaderDropAt(p),
  };
}

/**
 * The spreader's load-bearing underside centre, in world fractions — grip
 * plane y, feet-centre x. Everything the machine touches is stated against
 * this point.
 */
export function gripPose(p: number): Pose {
  const sp = spreaderPose(p);
  return { x: sp.x + SP_FEET_CX, y: sp.y + SP_GRIP_DY };
}

/** Cable: a vertical line from the head to the spreader's hang lug. */
export function cableDropAt(p: number): number {
  return spreaderDropAt(p);
}

/** The cable is only shown once it has visibly paid out past the dock. */
export function cableAlphaAt(p: number): number {
  return clamp01((spreaderDropAt(p) - 0.012) / 0.02);
}

export function truckPose(p: number): Pose {
  return { x: truckXAt(p), y: TRUCK_TOP_Y };
}

/** The trailer's load plane, in world fractions. Derived from the truck. */
export function deckPose(p: number): Pose {
  return { x: truckXAt(p) + DECK_CX * TRUCK_W, y: DECK_Y };
}

/**
 * The container. Its parent changes twice; its position is always read off
 * that parent in the same frame, never authored.
 *
 *   p <= pick          stack slot (castings on the door row's top face)
 *   pick..placeTouch   spreader — roof plane on the grip plane, casting
 *                      centre on the feet centre, exactly, every frame
 *   placeTouch..       trailer — casting underside welded to the deck plane
 *
 * All three regimes agree exactly at their boundary frames because the touch
 * values are the solved constants the tracks land on.
 */
export function containerPose(p: number): Pose {
  if (p <= BEAT.pick) return PICK_SLOT;

  if (p <= BEAT.placeTouch) {
    const grip = gripPose(p);
    return { x: grip.x - BOX_CAST_DX, y: grip.y - BOX_ROOF_DY };
  }

  const deck = deckPose(p);
  return { x: deck.x - BOX_CAST_DX, y: deck.y - BOX_BOTTOM_DY };
}

/** True while the twistlocks are seated — drives the lock indicator. */
export const isHeld = (p: number) => p > BEAT.pick && p < BEAT.release;

/**
 * Pendulum sway while the box hangs from the spreader, degrees about the grip
 * point. Two terms, both pure functions of p so reverse scrub replays exactly:
 * a lateral-acceleration coupling (the box lags the machine's speed changes)
 * and a free wobble that rings after the pick and decays as the carry settles.
 * Zero outside the held window and eased to zero into the place touch, so the
 * weld contacts stay exact.
 */
const SWAY_MAX_DEG = 1.0;
export function boxSwayDeg(p: number): number {
  if (p <= BEAT.pick || p >= BEAT.placeTouch) return 0;
  const h = 0.004;
  const a = gripPose(p - h).x;
  const b = gripPose(p).x;
  const c = gripPose(p + h).x;
  const drive = Math.tanh(((c - 2 * b + a) / (h * h)) * -0.035);
  const since = p - BEAT.pick;
  const wobble = Math.sin(since * 52) * Math.exp(-since * 5.5);
  const settleIn = Math.min(1, since / 0.02);
  const fadeOut = Math.min(1, (BEAT.placeTouch - p) / 0.03);
  return SWAY_MAX_DEG * (0.6 * drive + 0.4 * wobble) * settleIn * fadeOut;
}

/** Where the sway hinges: the grip point, as CSS transform-origin fractions. */
export const BOX_SWAY_ORIGIN = {
  xPct: (BOX_CAST_DX / BOX_W) * 100,
  yPct: (BOX_ROOF_DY / BOX_H) * 100,
} as const;

/**
 * Ground shadow under the airborne box, on the machine's own lane. Appears as
 * the load comes off the stack, spreads with height, and hands over to the
 * trailer's shadow at the placement.
 */
export function containerShadow(p: number): {
  x: number;
  y: number;
  scale: number;
  opacity: number;
} {
  const box = containerPose(p);
  const air = clamp01((GROUND_CRANE - (box.y + BOX_H)) / (BOX_H * 1.2));
  const vis =
    span(p, BEAT.pick, BEAT.pick + 0.05) *
    (1 - span(p, BEAT.placeTouch - 0.02, BEAT.placeTouch + 0.02));
  return {
    x: box.x + BOX_W / 2,
    y: GROUND_CRANE,
    scale: lerp(1, 1.35, air),
    opacity: lerp(0.55, 0.14, air) * vis,
  };
}

// ── Readouts ──────────────────────────────────────────────────────────────────

/** Path distance for the overhead run, in truck lengths. */
const PATH_START = 4;
export const PATH_TRAVEL = 22;

const TOP_SPEED_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.28, 1],
  [0.52, 0.96],
  [0.62, 0.66],
  [0.72, 0.7],
  [1, 1.05],
];

function topSpeedShape(t: number): number {
  const x = clamp01(t);
  for (let i = 1; i < TOP_SPEED_KEYS.length; i++) {
    const [x1, v1] = TOP_SPEED_KEYS[i];
    if (x <= x1) {
      const [x0, v0] = TOP_SPEED_KEYS[i - 1];
      return lerp(v0, v1, x1 === x0 ? 1 : smoother((x - x0) / (x1 - x0)));
    }
  }
  return TOP_SPEED_KEYS[TOP_SPEED_KEYS.length - 1][1];
}

const TOP_SAMPLES = 192;
/** Normalised integral of the shape, so distance and speed cannot disagree. */
const TOP_CUMULATIVE = (() => {
  const arr = new Float64Array(TOP_SAMPLES + 1);
  let acc = 0;
  for (let i = 1; i <= TOP_SAMPLES; i++) {
    acc += (topSpeedShape((i - 1) / TOP_SAMPLES) + topSpeedShape(i / TOP_SAMPLES)) / 2;
    arr[i] = acc;
  }
  const total = arr[TOP_SAMPLES] || 1;
  for (let i = 0; i <= TOP_SAMPLES; i++) arr[i] /= total;
  return arr;
})();

/**
 * The overhead leg starts rolling BEFORE the camera change completes, so the
 * top layer never fades in around a vehicle that has not yet moved.
 */
const TOP_RUN_IN = BEAT.camOut - 0.05;

function topUnit(p: number): number {
  const x = clamp01(span(p, TOP_RUN_IN, 1)) * TOP_SAMPLES;
  const i = Math.min(TOP_SAMPLES - 1, Math.floor(x));
  return TOP_CUMULATIVE[i] + (TOP_CUMULATIVE[i + 1] - TOP_CUMULATIVE[i]) * (x - i);
}

/** Distance along the drawn road, in truck lengths. */
export const pathDistance = (p: number) => PATH_START + PATH_TRAVEL * topUnit(p);

/** How far past the run the truck has pushed on toward the port. */
export const exitPush = (p: number) => Math.pow(span(p, BEAT.run, 1), 2);

const D = 0.0025;
/** km/h. Differentiated from the position itself, so a parked truck reads 00. */
export function speedKmh(p: number): number {
  const side = Math.abs(truckXAt(p + D) - truckXAt(p - D)) / (2 * D);
  return Math.min(120, side * 2.03);
}

export const LEG_KM = 1284;
/** The odometer logs the follow's own distance — same parameter as the strip. */
export const distanceKm = (p: number) => LEG_KM * driveT(p);

// ── The follow's camera ───────────────────────────────────────────────────────

/** Pull-back progress, eased. 0 = tripod framing, 1 = locked to the truck. */
export const driveZoom = (p: number) => smoother(span(p, DRIVE.zoomIn, DRIVE.zoomOut));

/** World scale under the pull-back. */
export const camScaleAt = (p: number) => 1 - (1 - DRIVE.scale) * driveZoom(p);

/**
 * The camera-transformed ground line, as a viewport fraction. The world layer's
 * transform origin sits ON the untransformed ground line (50%, STAGE.ground),
 * so scale leaves the ground where it is and the seam is just the translated
 * origin — one lerp, and SplitStage paints its seam from the same constant,
 * which is why the tyres stay on the join through the whole pull-back.
 */
export function camGroundFrac(p: number): number {
  return STAGE.ground + driveZoom(p) * (DRIVE.ground - STAGE.ground);
}

// ── Acts ──────────────────────────────────────────────────────────────────────

/**
 * The pin runs three acts. The yard story (everything above, in its own 0..1
 * "q" space) owns the first 11 of the pin's 18 viewports — the SAME scroll
 * distance it was authored and approved at — the tilt owns the next 3, and
 * the run (band → road, junction, the turn south) owns the last 4. Mapping
 * the raw pin progress through these functions is what lets the pin grow
 * without re-timing a single existing beat.
 */
export const ACTS = { story: 11 / 30, tilt: 14 / 30, run: 21 / 30, sea: 25 / 30 } as const;

/** Yard-story progress: 0..1 over the first 11 viewports, clamped after. */
export const storyQ = (p: number) => Math.min(1, p / ACTS.story);

/** Tilt-act progress: 0..1 over its 3 viewports, clamped either side. */
export const tiltT = (p: number) => clamp01((p - ACTS.story) / (ACTS.tilt - ACTS.story));

/** Run-act progress: 0..1 over its 7 viewports. */
export const runT = (p: number) => clamp01((p - ACTS.tilt) / (ACTS.run - ACTS.tilt));

/** Sea-act progress: 0..1 over its 4 viewports — the port. */
export const seaT = (p: number) => clamp01((p - ACTS.run) / (ACTS.sea - ACTS.run));

/** Air-act progress: 0..1 over the final 5 viewports — the climb. */
export const airT = (p: number) => clamp01((p - ACTS.sea) / (1 - ACTS.sea));

// ── The tilt: side elevation → overhead, like the reference's frame morph ────

export const TILT = {
  /** The seam's final resting height — the road's far edge. */
  seamEnd: 0.34,
  /** The road's near edge: a paper strip reappears under the tarmac. */
  bottom: 0.97,
  /** The roadside strip (cards, pill) has sunk and gone by here. */
  sinkOut: 0.3,
  /** Lane dashes fade in on the tarmac. */
  roadIn: 0.1,
  roadOut: 0.42,
  /** The camera swings overhead: side view flattens out, top view lands. */
  morphIn: 0.38,
  morphOut: 0.86,
  /**
   * THE TRUCK NEVER STOPS. Distance driven THROUGH the tilt, in world widths
   * — the wheels keep rolling, the dashes keep streaming, the odometer keeps
   * logging. Linear on purpose: constant cruise, no felt stop anywhere.
   */
  run: 1.4,
  /** The near edge sweeps in late, once the overhead framing has taken. */
  floorIn: 0.68,
  floorOut: 0.94,
  /**
   * Overhead truck's content centre, viewport fractions. topX sits DEAD ON
   * the junction's x: truck, south arm and the ship's hero slot are one
   * vertical line, so the sea handoff needs no sideways apology.
   */
  topX: 0.5,
  topY: 0.655,
  /**
   * Lane-dash rows, viewport fractions — SOLVED, not styled: the band's two
   * rows sit exactly where the road's two lane guide lines land under the
   * handoff camera (centre 0.655 ± LANE_LINE_F · bandHeight), so the swap to
   * the SVG network changes nothing on screen. The truck drives the
   * centreline between them, both here and on the network.
   */
  rows: [0.655 - 0.275 * 0.63, 0.655 + 0.275 * 0.63],
} as const;

/**
 * THE CUT, not a rotation. The old scene keeps the drive's ground line while
 * the loaded truck powers off frame right; the overhead scene arrives whole,
 * revealed by an expanding iris. So through the tilt the seam simply HOLDS.
 */
export const tiltSeamFrac = (_t: number) => DRIVE.ground;

/** Exit and iris beats, in tilt-act time. */
export const TILT_CUT = {
  /** The side truck is fully off frame right by here. */
  exitOut: 0.35,
  /** The iris starts opening as the truck's tail clears… */
  irisIn: 0.28,
  /** …and the overhead scene owns the whole frame by here. */
  irisOut: 0.88,
  /** How far the world shifts right for the exit, stage widths. */
  exitDist: 1.35,
} as const;

/** Accelerating exit — a vehicle pulling away, not a slide. */
export function tiltExitE(t: number): number {
  const e = span(t, 0, TILT_CUT.exitOut);
  return e * e;
}

/** Iris radius ease, 0..1 — the hole in the page opening onto the top view. */
export const tiltIrisE = (t: number) => smoother(span(t, TILT_CUT.irisIn, TILT_CUT.irisOut));

/** The night band's bottom edge: full bleed until the near edge sweeps in. */
export const tiltBandBottom = (t: number) =>
  lerp(1, TILT.bottom, smoother(span(t, TILT.floorIn, TILT.floorOut)));

/** How far the roadside strip has sunk out of the frame, 0..1. */
export const tiltSink = (t: number) => smoother(span(t, 0, TILT.sinkOut));

/** Lane-dash opacity. */
export const tiltRoadAlpha = (t: number) => span(t, TILT.roadIn, TILT.roadOut);

const tiltMorphE = (t: number) => smoother(span(t, TILT.morphIn, TILT.morphOut));

/**
 * THE ANGLE LADDER — the reference's own trick, finally done its way: the
 * SAME vehicle pre-rendered at intermediate camera elevations, scrubbed
 * through in sequence. Side rig → 15° → 40° → 65° → overhead rig, each
 * handing to the next over a short crossfade, all anchored on one drifting
 * centre so it reads as one truck rotating under a rising camera — never as
 * a second vehicle arriving.
 *
 * `lift` is each frame's progress along the side→overhead path: it places
 * the frame's centre between the side truck's centre and the overhead mark,
 * and scales its content between the two rigs' on-screen lengths.
 */
export const LADDER = [
  {
    src: "/assets/truck-a20-cut.webp",
    box: { x: 0.072794, y: 0.276693, w: 0.85625, h: 0.386719 },
    in: 0.36,
    out: 0.58,
  },
  {
    src: "/assets/truck-a45-cut.webp",
    box: { x: 0.058824, y: 0.189453, w: 0.883824, h: 0.611979 },
    in: 0.5,
    out: 0.72,
  },
  {
    src: "/assets/truck-a70-cut.webp",
    box: { x: 0.057353, y: 0.294271, w: 0.883824, h: 0.421224 },
    in: 0.64,
    out: 0.86,
  },
] as const;

export type LadderFrame = (typeof LADDER)[number];

/** A frame's opacity window: quick fade in, hold, quick fade to the next. */
export const ladderAlpha = (t: number, f: LadderFrame) =>
  span(t, f.in, f.in + 0.08) * (1 - span(t, f.out - 0.08, f.out));

/**
 * THE ONE ANCHOR PATH. Every rung — whichever is visible, including both
 * sides of every crossfade — sits on the SAME baseline and the SAME length,
 * both driven by this single ease over the whole morph. Frames dissolve IN
 * PLACE while the anchor glides from the side rig's ground line to the
 * overhead rig's content bottom; per-frame positions were what made the
 * hand-offs read as images jumping around.
 */
export const morphPathE = (t: number) =>
  smoother(span(t, LADDER[0].in, LADDER[2].out - 0.04));

/** Side truck content-box centre, above its ground line, world-h fraction. */
export const TRUCK_SIDE_LIFT =
  (TRUCK_GROUND - (TRUCK_EMPTY.contentBox.y + TRUCK_EMPTY.contentBox.h / 2)) * TRUCK_H;
/** Side truck content width, world-w fraction — the ladder's start length. */
export const TRUCK_CONTENT_W = TRUCK_EMPTY.contentBox.w * TRUCK_W;
/** Overhead rig content height, as a fraction of its wrap WIDTH. */
export const TOP_CONTENT_H_OF_WRAPW =
  TRUCK_TOP_SRC.contentBox.h * (TRUCK_TOP_SRC.h / TRUCK_TOP_SRC.w);

/**
 * With the ladder carrying the rotation, the rigs only LEAD the move: a
 * small lay-back before the 15° frame takes over, a small stand-up after
 * the 65° frame hands off.
 */
export const sideTiltDeg = (t: number) => 16 * tiltMorphE(t);
/** Side view hands off to the ladder's first frame. */
export const sideAlphaAt = (t: number) => 1 - span(t, LADDER[0].in, LADDER[0].in + 0.08);
/** Overhead view takes over from the ladder's last frame. */
export const topAlphaAt = (t: number) => span(t, LADDER[2].out - 0.08, LADDER[2].out);
/** The overhead frame stands up from a barely tipped, slightly wide pose. */
export const topTiltDeg = (t: number) => -10 * (1 - tiltMorphE(t));
export const topScaleAt = (t: number) => 1 + 0.06 * (1 - tiltMorphE(t));

/**
 * THE GROUND ROTATES TOO. The lane-dash plane starts laid back like tarmac
 * seen from a low chase camera — rows foreshortened toward the seam — and
 * rotates flat to plan view on the same ease the truck stands up with, so
 * vehicle and road always agree about where the camera is.
 */
export const roadTiltDeg = (t: number) => 55 * (1 - tiltMorphE(t));

/** Distance driven through the tilt so far, world widths. Linear — no stop. */
export const tiltRunU = (t: number) => TILT.run * t;

// ── The run: the band becomes the road, and the truck rides it south ─────────

/**
 * The reference's shrink is one move: the full-bleed tarmac IS the road's
 * west arm, seen from so low an altitude it fills the frame. The camera
 * climbs (K0 → 1, solved so the arm's thickness equals the band exactly at
 * the handoff frame), the junction sweeps IN from off frame right, and the
 * truck — never stopping — shrinks onto the carriageway, takes the bend and
 * runs out south. All of it is stated against the same road.ts network the
 * overhead sampler reads, so the vehicle cannot leave the tarmac.
 */
export const RUN = {
  /**
   * Camera fully out only as the bend completes: the climb RUNS THROUGH the
   * turn, so the zoom-out and the curvature read as one camera move — the
   * reference's pull-back on the corner.
   */
  shrinkOut: 0.45,
  /** How far right the junction is parked at the handoff, stage widths. */
  junctionOff: 1.6,
  /** The truck hands itself from the tilt pose to the path over this window. */
  blendIn: 0.2,
  /** The route headline fades in as the truck exits the bend. */
  typeIn: 0.46,
  typeInEnd: 0.56,
  /** Odometer's run leg, km. */
  km: 240,
  /**
   * The right-hand cards' reveal marks along the south run — each fades the
   * previous one out as it rises in with its glow.
   */
  cards: [0.52, 0.68, 0.84],
  cardFade: 0.05,
} as const;

/** Camera climb, 0 = band-filling altitude, 1 = drawn road scale. */
export const runShrinkE = (t: number) => smoother(span(t, 0, RUN.shrinkOut));
/** Tilt-pose → path-pose hand-over. */
export const runBlendE = (t: number) => smoother(span(t, 0, RUN.blendIn));

/**
 * Route progress through the act. u0 is solved, not guessed: under the
 * handoff camera (K0, junction parked junctionOff right) the point that maps
 * to the truck's tilt pose sits ~2.4 units along the west arm — u ≈ 0.31.
 * The bend spans u ≈ 0.38..0.67 and is TAKEN DURING THE CLIMB (t 0.28..0.45),
 * so the zoom-out and the turn are one move; the south leg then owns the
 * rest of the act while the route cards swap by.
 */
const RUN_U: Key[] = [
  [0, 0.31],
  [0.28, 0.384, smoother],
  [RUN.shrinkOut, 0.667, inOut],
  [1, 0.985, outCubic],
];
export const runU = (t: number) => track(RUN_U, t);

// ── The sea: curtain up, the same container already on deck ─────────────────

/**
 * THE PORT CUT. The whole road world lifts off like a curtain, and under it
 * the ship scene is already waiting — zoomed right in, our white VEYRA
 * container (the same sprite the truck carried) sitting in the deck's empty
 * slot exactly where the truck stood. Then the camera pulls up and up: the
 * whole vessel, the feature cards flanking it, and finally the clouds.
 */
export const SEA = {
  /**
   * THE HANDOFF, choreographed like the reference: the truck drives down to
   * the road's end and the CONTAINER stops on its mark — but the tractor
   * (and the trailer under it) keeps driving, accelerating out through the
   * section's bottom edge, which CLIPS it away mid-stride. The rising edge
   * then sweeps up through the stopped container itself — and because the
   * ship's identical, identically-sized copy waits pixel-aligned beneath,
   * the box simply changes vehicles as the edge passes.
   */
  tractorOut: [0.1, 0.26],
  /** Phase A: the drive down to the road's end. */
  driveIn: [0, 0.14],
  /** How far the truck drives in phase A, viewport fractions. */
  driveD: 0.24,
  /** The screen line the container is pinned on through the sweep —
      measured off the live rig, not estimated. */
  handoffY: 0.86,
  /** The road world lifts away over this window. */
  curtain: [0.1, 0.34],
  /**
   * The pull-up's ALTITUDE track, 0..1 in log-zoom space across BOTH
   * shots: the close plate rides it from the solved handoff zoom down to
   * exactly cover-fit (its edges can never enter frame), a crossfade hands
   * over to the far-altitude shot at matched ship size, and the far shot
   * rides the remainder down to its own cover-fit — the vessel small in a
   * vast ocean. Altitude is mostly gained by 0.72, before the clouds
   * enter: no cumulus at deck height.
   */
  zoom: [
    [0, 0],
    [0.32, 0],
    [0.72, 0.85, smoother],
    [1, 1, smoother],
  ] as Key[],
  /** The crossfade's blend width, in altitude units. */
  crossFade: 0.05,
  /** The display headline lands as the whole vessel first fits the frame. */
  typeIn: 0.36,
  typeInEnd: 0.46,
  /** Feature-card reveal marks along the pull-back. */
  cards: [0.5, 0.64, 0.78, 0.9],
  cardFade: 0.05,
  /** Clouds drift in over the final stretch. */
  cloudsIn: 0.72,
  /** Odometer's sea leg, km. */
  km: 580,
} as const;

/**
 * THE AIR. The reference's closing move: the cumulus deck slides over the
 * far-off vessel until the whole frame is cloud, then the freighter crosses
 * left to right above the weather — and the page hands off to daylight.
 */
export const AIR = {
  /**
   * The whiteout is BUILT, not pasted: puff sprites sail in from BOTH
   * wings and coverage comes from their density. The window is stated in
   * SEA-act time on purpose — the weather closes in WHILE the drone is
   * still climbing, and the last puff lands exactly as the ascent tops
   * out (ASC_WIN.out), never after the footage has stopped moving.
   */
  clouds: [0.42, 0.8],
  /** How long one puff's own entry takes, in that same time base. */
  cloudRun: 0.2,
  /**
   * The crossing: the freighter drags the next section in behind it. It
   * enters as soon as the act does — the weather is already closed by the
   * time the sea act hands over, so there is nothing to wait for; any
   * later and the reader scrolls through dead altitude to find it.
   */
  plane: [0.03, 0.86],
  /** Cruise the instruments settle on, km/h. */
  cruise: 878,
  /** Odometer's air leg, km. */
  km: 1400,
} as const;

/** Per-puff entry ease: staggered starts across the clouds window. */
export const airCloudE = (t: number, i: number, n: number) => {
  const t0 = AIR.clouds[0] + ((AIR.clouds[1] - AIR.clouds[0] - AIR.cloudRun) * i) / Math.max(1, n - 1);
  return smoother(span(t, t0, t0 + AIR.cloudRun));
};
/** Crossing progress, eased so the freighter arrives braking, not parking. */
export const airPlaneU = (t: number) => smoother(span(t, AIR.plane[0], AIR.plane[1]));

export const seaCurtainE = (t: number) => smoother(span(t, SEA.curtain[0], SEA.curtain[1]));

/** The cab's wipe, 0..1 — at the road's end, just ahead of the sweep. */
export const seaTractorE = (t: number) =>
  smoother(span(t, SEA.tractorOut[0], SEA.tractorOut[1]));

/** Phase A of the handoff: the truck's last stretch of road, eased. */
export const seaDriveAE = (t: number) =>
  smoother(span(t, SEA.driveIn[0], SEA.driveIn[1]));

/** Ship pan: the hero slot waits on the container's line, then centres —
    fully home BEFORE the far-shot crossfade (~0.51), so the cut lands on a
    naturally-centred plate and the far offset is a pure constant solve. */
export const seaPanE = (t: number) => 1 - smoother(span(t, 0.32, 0.5));
export const seaZoomAt = (t: number) => track(SEA.zoom, t);
export const seaTypeE = (t: number) => span(t, SEA.typeIn, SEA.typeInEnd);
export const seaCloudsE = (t: number) => smoother(span(t, SEA.cloudsIn, 1));

/** Sea feature cards: same reveal grammar as the route cards. */
export const seaCardInE = (t: number, i: number) =>
  smoother(span(t, SEA.cards[i], SEA.cards[i] + SEA.cardFade));
export function seaCardAlpha(t: number, i: number): number {
  const next = SEA.cards[i + 1];
  const out = next === undefined ? 1 : 1 - span(t, next, next + SEA.cardFade);
  return seaCardInE(t, i) * out;
}
export const seaCardGlow = (t: number, i: number) =>
  seaCardInE(t, i) *
  (1 - span(t, SEA.cards[i] + SEA.cardFade + 0.02, SEA.cards[i] + SEA.cardFade + 0.1));

/** A card's reveal ease: 0 before its mark, 1 once risen. */
export const cardInE = (rT: number, i: number) =>
  smoother(span(rT, RUN.cards[i], RUN.cards[i] + RUN.cardFade));

/** A card's visibility: in with its reveal, out as the next card arrives. */
export function cardAlpha(rT: number, i: number): number {
  const next = RUN.cards[i + 1];
  const out = next === undefined ? 1 : 1 - span(rT, next, next + RUN.cardFade);
  return cardInE(rT, i) * out;
}

/**
 * The reveal's glow: a pulse that peaks as the card lands and dies away —
 * the ticker turns it into a soft blue drop-shadow.
 */
export const cardGlow = (rT: number, i: number) =>
  cardInE(rT, i) * (1 - span(rT, RUN.cards[i] + RUN.cardFade + 0.02, RUN.cards[i] + RUN.cardFade + 0.1));

/** The cruise leg's constant speed, from its own slope — the readout's hold. */
const CRUISE_KMH = ((DRIVE.units - 0.35) / (0.985 - 0.73)) * 2.03;

/**
 * HUD speed from the RAW pin progress: the story's differentiated readout,
 * held at cruise through the tilt — the vehicle is still driving while the
 * camera swings, so the counter may never fall back to 00 mid-move.
 */
export function hudSpeedKmh(pin: number): number {
  const a = airT(pin);
  const t = tiltT(pin);
  const s = speedKmh(storyQ(pin));
  const ground = t > 0 ? Math.max(s, CRUISE_KMH) : s;
  // The climb: the readout spools from cruise to flight level as the
  // freighter takes the leg — the instrument's own act change.
  return a > 0 ? ground + (AIR.cruise - ground) * smoother(span(a, 0.3, 0.75)) : ground;
}

/** HUD odometer from the RAW pin progress: keeps logging through every act. */
export const hudDistanceKm = (pin: number) =>
  LEG_KM * (driveT(storyQ(pin)) + tiltRunU(tiltT(pin)) / DRIVE.units) +
  RUN.km * runT(pin) +
  SEA.km * seaT(pin) +
  AIR.km * airT(pin);

// ── Layer opacity ─────────────────────────────────────────────────────────────

/**
 * The frame in which the night starts taking the whole stage, and therefore the
 * earliest the side elevation may move. SplitStage states its takeover mark from
 * this same constant: the truck's tyres are on the split's seam by construction
 * ONLY while the layer carrying them is untransformed, so the camera push cannot
 * begin until the seam has stopped being a seam.
 */
export const CAM_OUT_IN = BEAT.depart + 0.075;

/** Camera push as the side view leaves the lens, 0..1. */
export const camPush = (p: number) => span(p, CAM_OUT_IN, BEAT.camOut);
export const camSettle = (p: number) => span(p, BEAT.topIn - 0.11, BEAT.topIn);

export const exitOpacity = (p: number) =>
  span(p, BEAT.run, BEAT.run + 0.04) * (1 - span(p, 0.985, 1));

// ── Wheel overlays ────────────────────────────────────────────────────────────

export interface WheelPlacement {
  widthPct: number;
  leftPct: number;
  topPct: number;
}

/**
 *   overlayW = r_i / wheel.r                       (fraction of vehicle width)
 *   overlayH = overlayW * vehicleAspect            (fraction of vehicle height)
 *   left     = cx_i - wheel.cx * overlayW
 *   top      = cy_i - wheel.cy * overlayH
 *
 * The offsets land the overlay's HUB on the measured hub, which is not the
 * wheel image's bounding-box centre.
 */
export const WHEEL_PLACEMENTS: WheelPlacement[] = TRUCK_EMPTY.wheels.map((w) => {
  const ow = w.r / WHEEL.r;
  const oh = ow * TRUCK_ASPECT;
  return {
    widthPct: ow * 100,
    leftPct: (w.cx - WHEEL.cx * ow) * 100,
    topPct: (w.cy - WHEEL.cy * oh) * 100,
  };
});

export const WHEEL_ORIGIN = `${(WHEEL.cx * 100).toFixed(4)}% ${(WHEEL.cy * 100).toFixed(4)}%`;

/** Mean tyre diameter as a fraction of the rendered truck width. */
export const WHEEL_DIAMETER_FRAC =
  (TRUCK_EMPTY.wheels.reduce((sum, w) => sum + w.r, 0) / TRUCK_EMPTY.wheels.length) * 2;

/**
 * Crane wheels, same rule against the crane-wheel render — with per-wheel
 * diameters, because the two tyres measure differently, and a circular clip
 * because crane-wheel-cut's alpha keeps its baked ground shadow, which must
 * not spin.
 */
export const CRANE_WHEEL_PLACEMENTS = CRANE_BODY.wheels.map((w) => {
  const ow = w.r / CRANE_WHEEL_SRC.r;
  const oh = ow * RIG_ASPECT;
  return {
    widthPct: ow * 100,
    leftPct: (w.cx - CRANE_WHEEL_SRC.cx * ow) * 100,
    topPct: (w.cy - CRANE_WHEEL_SRC.cy * oh) * 100,
    /** Rendered tyre diameter as a fraction of the body's rendered width. */
    diameterFrac: 2 * w.r,
  };
});

export const CRANE_WHEEL_ORIGIN = `${(CRANE_WHEEL_SRC.cx * 100).toFixed(4)}% ${(CRANE_WHEEL_SRC.cy * 100).toFixed(4)}%`;
export const CRANE_WHEEL_CLIP = `circle(${(CRANE_WHEEL_CLIP_R * 100).toFixed(2)}% at ${(CRANE_WHEEL_SRC.cx * 100).toFixed(4)}% ${(CRANE_WHEEL_SRC.cy * 100).toFixed(4)}%)`;

/**
 * Rolled distance in world-width units, per vehicle. Each IS the x that
 * translates its body — not a companion tween — so tyres cannot disagree with
 * the chassis at any scroll position: reversing counter-rotates them and a
 * backwards scrub unwinds them.
 */
export const rolledUnits = (p: number) => truckXAt(p);
export const craneRolledUnits = (p: number) => cranePose(p).x;

// ── Asset descriptors ─────────────────────────────────────────────────────────

export const SPRITE = {
  craneBody: { src: "/assets/crane-body-cut.webp", w: CRANE_BODY.w, h: CRANE_BODY.h },
  craneBoom: { src: "/assets/crane-boom-cut.webp", w: CRANE_BOOM.w, h: CRANE_BOOM.h },
  /** Outer barrel + pivot plate only — the static sleeve the boom slides from. */
  boomSleeve: { src: "/assets/boom-sleeve-cut.webp", w: CRANE_BOOM.w, h: CRANE_BOOM.h },
  craneWheel: { src: "/assets/crane-wheel-cut.webp", w: CRANE_WHEEL_SRC.w, h: CRANE_WHEEL_SRC.h },
  spreader: { src: "/assets/spreader-cut.webp", w: SPREADER_SRC.w, h: SPREADER_SRC.h },
  truck: { src: "/assets/truck-empty-cut.webp", w: TRUCK_EMPTY.w, h: TRUCK_EMPTY.h },
  truckTop: { src: "/assets/truck-empty-top-cut.webp", w: TRUCK_TOP_SRC.w, h: TRUCK_TOP_SRC.h },
  containerTop: {
    src: "/assets/container-top-cut.webp",
    w: CONTAINER_TOP_SRC.w,
    h: CONTAINER_TOP_SRC.h,
    box: CONTAINER_TOP_SRC.contentBox,
  },
  wheel: { src: "/assets/wheel-cut.webp", w: WHEEL.w, h: WHEEL.h },
  box: { src: "/assets/container-veyra-cut.webp", w: BOX_SRC.w, h: BOX_SRC.h, box: BOX_SRC.contentBox },
  doorBlue: {
    src: "/assets/door-blue-cut.webp",
    w: DOOR_BLUE_SRC.w,
    h: DOOR_BLUE_SRC.h,
    box: DOOR_BLUE_SRC.contentBox,
  },
  doorOrange: {
    src: "/assets/door-orange-cut.webp",
    w: DOOR_ORANGE_SRC.w,
    h: DOOR_ORANGE_SRC.h,
    box: DOOR_ORANGE_SRC.contentBox,
  },
} as const;

/** Overhead vehicle: centre of the content box is what rides the centreline. */
export const TOP_BODY_W = TRUCK_TOP_SRC.contentBox.w;
export const TOP_BODY_CX = TRUCK_TOP_SRC.contentBox.x + TRUCK_TOP_SRC.contentBox.w / 2;
export const TOP_BODY_CY = TRUCK_TOP_SRC.contentBox.y + TRUCK_TOP_SRC.contentBox.h / 2;
export const TOP_ORIGIN = `${(TOP_BODY_CX * 100).toFixed(4)}% ${(TOP_BODY_CY * 100).toFixed(4)}%`;

/**
 * The deck rect the plan-view VEYRA box composites onto, in fractions of the
 * overhead truck canvas — straight from manifest truckEmptyTop.deck.
 */
export const TOP_DECK = {
  x: TRUCK_TOP_SRC.deck.x0,
  y: TRUCK_TOP_SRC.deck.y0,
  w: TRUCK_TOP_SRC.deck.x1 - TRUCK_TOP_SRC.deck.x0,
  h: TRUCK_TOP_SRC.deck.y1 - TRUCK_TOP_SRC.deck.y0,
} as const;

export const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
