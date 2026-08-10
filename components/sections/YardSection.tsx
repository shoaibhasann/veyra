"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import AirScene, { AIR_CLOUDS, PLANE_EXIT, PLANE_SEAM } from "@/components/yard/AirScene";
import CraneRig from "@/components/yard/CraneRig";
import DoorStack from "@/components/yard/DoorStack";
import FollowStrip from "@/components/yard/FollowStrip";
import RoadPath from "@/components/yard/RoadPath";
import RouteContent, { ROUTE_CARDS } from "@/components/yard/RouteContent";
import ShipScene, {
  ASCENT,
  SHIP_CARDS,
  SHIP_FRAME,
  SHIP_SLOT,
  ascentSlotAt,
} from "@/components/yard/ShipScene";

import SpeedReadout from "@/components/yard/SpeedReadout";
import SplitStage, { splitTone } from "@/components/yard/SplitStage";
import SpreaderRig from "@/components/yard/SpreaderRig";
import TruckRig from "@/components/yard/TruckRig";
import TruckTopRig from "@/components/yard/TruckTopRig";
import VeyraBox from "@/components/yard/VeyraBox";
import YardStory from "@/components/yard/YardStory";
import {
  ACTS,
  BEAT,
  BOX_H,
  BOX_SWAY_ORIGIN,
  BOX_W,
  DRIVE,
  LAYER,
  SEA,
  TOP_DECK,
  CRANE_BODY_W,
  CRANE_SHADOW,
  CRANE_WHEEL_PLACEMENTS,
  GROUND,
  STAGE,
  WHEEL_DIAMETER_FRAC,
  WHEEL_PLACEMENTS,
  WORLD,
  TRUCK_W,
  BOOM_EXT_AXIS,
  RUN,
  TILT,
  TILT_CUT,
  TOP_BODY_CX,
  TOP_BODY_CY,
  TOP_BODY_W,
  boomExtRatioAt,
  boomHeadPose,
  boomRotationAt,
  cableAlphaAt,
  cableDropAt,
  camGroundFrac,
  camScaleAt,
  cardAlpha,
  cardInE,
  clamp01,
  boxSwayDeg,
  containerPose,
  containerShadow,
  cranePose,
  craneRolledUnits,
  driveT,
  driveZoom,
  hudDistanceKm,
  hudSpeedKmh,
  pct,
  rolledUnits,
  runBlendE,
  runShrinkE,
  runT,
  runU,
  seaCardAlpha,
  seaCardInE,
  seaCurtainE,
  seaDriveAE,
  seaPanE,
  airCloudE,
  airPlaneU,
  airT,
  seaT,
  seaTractorE,
  seaTypeE,
  seaZoomAt,
  smoother,
  span,
  spreaderPose,
  storyQ,
  tiltExitE,
  tiltIrisE,
  tiltRunU,
  tiltSink,
  tiltT,
  truckFollowCx,
  truckPose,
} from "@/components/yard/geometry";
import { prepareWipe, wipeAccent, wipeGroup } from "@/lib/wipe";
import { JUNCTION, ROAD_WIDTH, roadUnitPx, sampleTravel } from "@/components/yard/road";
import { useWheelRotation } from "@/hooks/useWheelRotation";
import { gsap } from "@/lib/gsap";
import { revertSplit, scrambleText, splitLines } from "@/lib/scramble";

/** The scroll window (in sea-act time) mapped onto the ascent clip's clock. */
const ASC_WIN = { in: 0.42, out: 0.8 } as const;

/** Sea-act mark the weather starts closing in — inside the climb, by design. */
const SEA_CLOUD_IN = 0.4;

const CHAPTERS = [
  {
    eyebrow: "01 — Terminal",
    headline: "Containers, handled.",
    label: "Lock on",
    copy: "The spreader finds the corner castings, takes the weight and swings the box onto a waiting chassis. Nine seconds, every time.",
  },
  {
    eyebrow: "02 — Land",
    headline: "Assembled for the long haul.",
    label: "Linehaul",
    copy: "Weight set to axle limits, seal photographed at the gate, telematics pushing a fresh ETA every ninety seconds — the same one your customer is watching.",
  },
  {
    eyebrow: "03 — Sea",
    headline: "Every nautical mile, accounted for.",
    label: "Blue water",
    copy: "The same container, the same watch: position and telemetry stream ashore from the moment the vessel clears the berth.",
  },
  {
    eyebrow: "04 — Air",
    headline: "Above the weather, on the clock.",
    label: "Uplift",
    copy: "When the schedule cannot wait for water, the urgent freight climbs: same manifest, same watch, wheels-up to wheels-down.",
  },
] as const;

/**
 * The copy band arrives as the box settles onto the deck and is gone BEFORE
 * the split's black floor starts rising at BEAT.depart (0.66), so ink is never
 * printed on night and the band never shares a frame with the seam.
 */
const BAND = { in: 0.505, up: 0.545, down: 0.6, out: 0.635 } as const;

/** Chapter hand-off is for the eyebrow alone, and lands while the band is out. */
const CHAPTER_FLIP = 0.8;

const bandOpacity = (p: number) =>
  span(p, BAND.in, BAND.up) * (1 - span(p, BAND.down, BAND.out));

const chapterFor = (p: number) => (p < BAND.in ? -1 : p < CHAPTER_FLIP ? 0 : 1);

/** Ink on paper, paper on night — the same hand-off the speed readout makes. */
const toneColor = (t: number) =>
  t <= 0
    ? "var(--color-ink)"
    : t >= 1
      ? "var(--color-paper)"
      : `color-mix(in oklab, var(--color-paper) ${(t * 100).toFixed(0)}%, var(--color-ink))`;

const BOX_SHADOW_W = BOX_W * 1.16;

const NO_WHEELS: RefObject<HTMLImageElement | null>[] = [];

interface Metrics {
  worldW: number;
  worldH: number;
  stageW: number;
  stageH: number;
  /** Content widths of the follow's roadside layers, for their travel maps. */
  stripW: number;
  ghostW: number;
}

export default function YardSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const groundLayerRef = useRef<HTMLDivElement>(null);
  const sideLayerRef = useRef<HTMLDivElement>(null);
  const topLayerRef = useRef<HTMLDivElement>(null);

  const craneBodyRef = useRef<HTMLDivElement>(null);
  const boomRef = useRef<HTMLDivElement>(null);
  const boomHeadRef = useRef<HTMLDivElement>(null);
  const spreaderRef = useRef<HTMLDivElement>(null);
  const cableRef = useRef<HTMLSpanElement>(null);
  const craneShadowRef = useRef<HTMLSpanElement>(null);
  const truckBodyRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const boxShadowRef = useRef<HTMLSpanElement>(null);

  const ghostRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const topSceneRef = useRef<HTMLDivElement>(null);
  const topBandRef = useRef<HTMLDivElement>(null);
  const routeLeftRef = useRef<HTMLDivElement>(null);
  const cardRefs = useMemo<RefObject<HTMLDivElement | null>[]>(
    () => ROUTE_CARDS.map(() => ({ current: null })),
    [],
  );

  const shipRootRef = useRef<HTMLDivElement>(null);
  const shipWrapRef = useRef<HTMLDivElement>(null);
  const shipAscentRef = useRef<HTMLVideoElement>(null);
  const shipHeroRef = useRef<HTMLDivElement>(null);

  const airRootRef = useRef<HTMLDivElement>(null);
  const airCloudRefs = useMemo<RefObject<HTMLDivElement | null>[]>(
    () => AIR_CLOUDS.map(() => ({ current: null })),
    [],
  );
  const airPanelRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const stripPanels = useRef<
    { el: HTMLElement; accent: HTMLElement | null; x: number; w: number }[]
  >([]);
  const airPlaneRef = useRef<HTMLDivElement>(null);
  const shipTypeRef = useRef<HTMLDivElement>(null);
  const shipCardRefs = useMemo<RefObject<HTMLDivElement | null>[]>(
    () => SHIP_CARDS.map(() => ({ current: null })),
    [],
  );

  const topWrapRef = useRef<HTMLDivElement>(null);
  const tractorRef = useRef<HTMLImageElement>(null);
  const roadGroupRef = useRef<SVGGElement>(null);

  const copyWrapRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const eyebrowToneRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  /** Every derived value in the rig is a pure function of this one number. */
  const progressRef = useRef({ p: 0 });
  const metricsRef = useRef<Metrics>({
    worldW: 0,
    worldH: 0,
    stageW: 0,
    stageH: 0,
    stripW: 0,
    ghostW: 0,
  });

  /** -1 = copy band still hidden. Keyed onto the nodes, so each step remounts. */
  const [chapter, setChapter] = useState(-1);
  /**
   * null until the client has looked. CSS owns the breakpoint (`.yard-live` in
   * globals.css); this only asks the DOM which of the two compositions is
   * actually displayed, so the query is stated exactly once, in one language.
   */
  const [live, setLive] = useState<boolean | null>(null);

  const wheelRefs = useMemo<RefObject<HTMLImageElement | null>[]>(
    () => WHEEL_PLACEMENTS.map(() => ({ current: null })),
    [],
  );
  const craneWheelRefs = useMemo<RefObject<HTMLImageElement | null>[]>(
    () => CRANE_WHEEL_PLACEMENTS.map(() => ({ current: null })),
    [],
  );

  useWheelRotation(live ? wheelRefs : NO_WHEELS, {
    wheelDiameterPx: () => metricsRef.current.worldW * TRUCK_W * WHEEL_DIAMETER_FRAC,
    // The truck's own x IS the follow's drive distance — plus the tilt's run,
    // because the vehicle keeps driving while the camera swings. Both are
    // pure functions of the pin, so a reverse scrub unwinds the tyres too.
    getDistancePx: () =>
      (rolledUnits(storyQ(progressRef.current.p)) + tiltRunU(tiltT(progressRef.current.p))) *
      metricsRef.current.worldW,
    direction: 1,
  });

  /**
   * Crane tyres: one hook per wheel, because the two tyres measure differently
   * and the rule is per-wheel radius from the manifest. The distance IS the
   * body's own x — the same value that translates the chassis — so approach,
   * the creep under the steepening boom, the reverse toward the truck and the
   * exit all roll (and counter-roll, and unwind on a backwards scrub) exactly.
   */
  useWheelRotation(live ? [craneWheelRefs[0]] : NO_WHEELS, {
    wheelDiameterPx: () =>
      metricsRef.current.worldW * CRANE_BODY_W * CRANE_WHEEL_PLACEMENTS[0].diameterFrac,
    getDistancePx: () =>
      craneRolledUnits(storyQ(progressRef.current.p)) * metricsRef.current.worldW,
    direction: 1,
  });
  useWheelRotation(live ? [craneWheelRefs[1]] : NO_WHEELS, {
    wheelDiameterPx: () =>
      metricsRef.current.worldW * CRANE_BODY_W * CRANE_WHEEL_PLACEMENTS[1].diameterFrac,
    getDistancePx: () =>
      craneRolledUnits(storyQ(progressRef.current.p)) * metricsRef.current.worldW,
    direction: 1,
  });

  useEffect(() => {
    const stage = stageRef.current;
    const section = sectionRef.current;
    if (!stage || !section) return;

    // Read `display` itself, not `offsetParent` — the pin puts the stage into
    // `position: fixed`, which nulls `offsetParent` and would make the rig tear
    // itself down the moment it engaged.
    const sync = () => setLive(window.getComputedStyle(stage).display !== "none");
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(section);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (!live) return;

    const section = sectionRef.current;
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!section || !stage || !world) return;

    const measure = () => {
      const m = metricsRef.current;
      m.worldW = world.clientWidth;
      m.worldH = world.clientHeight;
      m.stageW = stage.clientWidth;
      m.stageH = stage.clientHeight;
      m.stripW = stripRef.current?.offsetWidth ?? 0;
      // Each roadside panel reveals on ITS OWN arrival, so the ticker needs
      // their positions inside the strip, not just the strip's width.
      stripPanels.current = stripRef.current
        ? [...stripRef.current.querySelectorAll<HTMLElement>("[data-strip-panel]")].map((el) => ({
            el,
            accent: el.querySelector<HTMLElement>("[data-strip-accent]"),
            x: el.offsetLeft,
            w: el.offsetWidth,
          }))
        : [];
      m.ghostW = ghostRef.current?.offsetWidth ?? 0;
    };

    const last = new Map<string, string>();
    const write = (
      el: HTMLElement | SVGElement | null,
      prop: "transform" | "filter" | "opacity" | "color" | "width" | "clip-path" | "visibility",
      key: string,
      value: string,
    ) => {
      if (!el || last.get(key) === value) return;
      last.set(key, value);
      el.style.setProperty(prop, value);
    };

    const render = () => {
      const m = metricsRef.current;
      // The pin's raw progress spans both acts; the yard story runs on its
      // own clamped q so extending the pin re-timed nothing, and the tilt
      // runs on t. Everything below that reads `p` is story-act.
      const pin = progressRef.current.p;
      const p = storyQ(pin);
      const t = tiltT(pin);
      const { worldW: W, worldH: H } = m;

      // ── Side elevation. The chain is evaluated once, in one frame: body,
      //    boom angle, head, hanging spreader, welded box. ────────────────────
      const crane = cranePose(p);
      write(
        craneBodyRef.current,
        "transform",
        "crane",
        `translate3d(${(crane.x * W).toFixed(1)}px, ${(crane.y * H).toFixed(1)}px, 0)`,
      );
      write(
        boomRef.current,
        "transform",
        "boom",
        `rotate(${boomRotationAt(p).toFixed(3)}deg)`,
      );
      // Telescoping section: same rotation, plus a slide along the drawn boom
      // axis. translate% is of the element's own box, which is exactly the
      // sprite-fraction unit BOOM_EXT_AXIS is measured in.
      const extR = boomExtRatioAt(p);
      write(
        boomHeadRef.current,
        "transform",
        "boomHead",
        `rotate(${boomRotationAt(p).toFixed(3)}deg) ` +
          `translate(${(BOOM_EXT_AXIS.x * extR * 100).toFixed(2)}%, ${(
            BOOM_EXT_AXIS.y * extR * 100
          ).toFixed(2)}%)`,
      );

      const sp = spreaderPose(p);
      write(
        spreaderRef.current,
        "transform",
        "spreader",
        `translate3d(${(sp.x * W).toFixed(1)}px, ${(sp.y * H).toFixed(1)}px, 0)`,
      );

      // The hoist line: from the head, exactly as long as the pay-out.
      const head = boomHeadPose(p);
      write(
        cableRef.current,
        "transform",
        "cable",
        `translate3d(${(head.x * W - 1).toFixed(1)}px, ${(head.y * H).toFixed(1)}px, 0) ` +
          `scaleY(${cableDropAt(p).toFixed(5)})`,
      );
      write(cableRef.current, "opacity", "cableO", cableAlphaAt(p).toFixed(3));

      write(
        craneShadowRef.current,
        "transform",
        "craneShadow",
        `translate3d(${((crane.x + CRANE_SHADOW.cx - CRANE_SHADOW.width / 2) * W).toFixed(1)}px, ` +
          `${((GROUND.crane - 0.013) * H).toFixed(1)}px, 0)`,
      );

      const truck = truckPose(p);
      write(
        truckBodyRef.current,
        "transform",
        "truck",
        `translate3d(${(truck.x * W).toFixed(1)}px, ${(truck.y * H).toFixed(1)}px, 0)`,
      );

      const box = containerPose(p);
      // Pendulum: rotation composes after the translate, hinged at the grip
      // point via the element's static transform-origin.
      write(
        boxRef.current,
        "transform",
        "box",
        `translate3d(${(box.x * W).toFixed(1)}px, ${(box.y * H).toFixed(1)}px, 0) ` +
          `rotate(${boxSwayDeg(p).toFixed(2)}deg)`,
      );

      const shadow = containerShadow(p);
      write(
        boxShadowRef.current,
        "transform",
        "boxShadow",
        `translate3d(${((shadow.x - BOX_SHADOW_W / 2) * W).toFixed(1)}px, ` +
          `${((shadow.y - 0.011) * H).toFixed(1)}px, 0) scale(${shadow.scale.toFixed(3)})`,
      );
      write(boxShadowRef.current, "opacity", "boxShadowO", shadow.opacity.toFixed(3));

      // ── THE FOLLOW + THE EXIT. One affine on the world layer, its origin ON
      //    the untransformed ground line: scale leaves the ground put, dy is
      //    just seam-minus-ground, and dx is solved from the truck's own x —
      //    the lens is welded to the vehicle through the drive. Then the cut:
      //    the lens lets go, and the whole world powers off frame RIGHT — an
      //    accelerating departure, wheels still rolling, never a fade. ────────
      const zoom = driveZoom(p);
      let cam = "";
      if (zoom > 0) {
        const s = camScaleAt(p);
        const OX = 0.5 * m.stageW;
        const worldLeft = (m.stageW - W) / 2;
        const cxPx = worldLeft + truckFollowCx(p) * W;
        const dx =
          zoom * (DRIVE.truckX * m.stageW - OX - s * (cxPx - OX)) +
          tiltExitE(t) * TILT_CUT.exitDist * m.stageW;
        const dy = (camGroundFrac(p) - STAGE.ground) * m.stageH;
        cam = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      }
      write(sideLayerRef.current, "transform", "cam", cam);

      // ── The roadside. Ghost type and card strip enter from the right and
      //    stream left by the drive's own distance parameter; through the tilt
      //    the strip sinks out of the frame and the lane dashes take the band.
      const dT = driveT(p);
      const sink = tiltSink(t);
      write(
        ghostRef.current,
        "transform",
        "ghost",
        `translate3d(${(m.stageW - Math.min(1, dT / 0.82) * (m.ghostW + m.stageW)).toFixed(1)}px, 0, 0)`,
      );
      write(
        stripRef.current,
        "transform",
        "strip",
        `translate3d(${(m.stageW - dT * (m.stripW + 0.02 * m.stageW)).toFixed(1)}px, ` +
          `${(sink * 0.22 * m.stageH).toFixed(1)}px, 0)`,
      );
      write(stripRef.current, "opacity", "stripO", (1 - sink).toFixed(3));
      // The roadside type reveals as it streams in, on the same distance
      // parameter that carries it — the edge crosses the words as they pass.
      wipeGroup(ghostRef.current, span(dT, 0.04, 0.5));
      // Every panel on its OWN arrival: one strip-wide progress would have
      // cards revealing while still off-frame and others already past.
      const stripX = m.stageW - dT * (m.stripW + 0.02 * m.stageW);
      for (const panel of stripPanels.current) {
        const entered = m.stageW - (stripX + panel.x);
        const pin = clamp01(entered / Math.max(1, panel.w * 0.85));
        wipeGroup(panel.el, pin);
        wipeAccent(panel.accent, pin, "var(--color-paper)");
      }

      // ── THE IRIS. The overhead scene is a complete page of its own — paper,
      //    tarmac band, streaming dashes, the loaded truck from above — and a
      //    circle opens onto it like a widening peephole while the old scene's
      //    truck is still clearing frame right. By irisOut it owns the frame.
      const rT = runT(pin);
      const sT = seaT(pin);
      // Through the tilt the layer's gate is the iris; from the sea act on
      // it is the layer's OWN RECT — so as the curtain rises, its bottom
      // edge cleanly cuts the departing tractor and then sweeps up through
      // the stopped container, revealing the ship's identical copy beneath.
      write(
        topSceneRef.current,
        "clip-path",
        "iris",
        sT > 0 ? "inset(0px)" : `circle(${(tiltIrisE(t) * 150).toFixed(1)}% at 50% 52%)`,
      );
      // The band and its dashes hand the frame to the SVG road at the run's
      // first frame — the arm covers the same rectangle, so nothing blinks.
      write(topBandRef.current, "opacity", "topBand", rT > 0 ? "0" : "1");
      // Pitch = dash + gap at the handoff camera: (0.34 + 0.30) road units ×
      // bandHeight/ROAD_WIDTH of the viewport — the same rule the markup's
      // svh dimensions are authored from, so the modulo wrap stays seamless.
      const lanePitch = 0.8766 * m.stageH;
      const laneRun = (tiltRunU(t) * DRIVE.scale * m.worldW) % lanePitch;
      write(
        lanesRef.current,
        "opacity",
        "lanes",
        (1 - span(rT, 0, 0.12)).toFixed(3),
      );
      write(
        lanesRef.current,
        "transform",
        "lanesY",
        `translate3d(${(-laneRun).toFixed(1)}px, 0, 0)`,
      );

      // ── THE RUN. One camera climb on the junction network: K0 is solved so
      //    the west arm IS the band at the handoff frame, the junction sweeps
      //    in from off frame right, and the truck blends onto the sampled
      //    path — shrinking, taking the bend, running out south. ─────────────
      const su = roadUnitPx(m.stageW, m.stageH);
      const shr = runShrinkE(rT);
      const jx = JUNCTION.x * m.stageW;
      const jy = JUNCTION.y * m.stageH;
      const K0 = ((TILT.bottom - TILT.seamEnd) * m.stageH) / (ROAD_WIDTH * su);
      const K = K0 + (1 - K0) * shr;
      const rtx = RUN.junctionOff * m.stageW * (1 - shr);
      const rty =
        ((TILT.seamEnd + TILT.bottom) / 2 - JUNCTION.y) * m.stageH * (1 - shr);
      // The truck's raw pose under that camera comes first: once it descends
      // past the follow line on the south leg, the WHOLE camera pans down
      // with it (the hinge keeps the pan continuous), so the horizontal arm
      // rides off the top and the vertical road takes the frame — the
      // reference's final column framing — with the vehicle never leaving it.
      const here = sampleTravel(runU(rT));
      const px = K * (here.x - jx) + jx + rtx;
      const pyRaw = K * (here.y - jy) + jy + rty;
      const pan = Math.max(0, pyRaw - 0.7 * m.stageH);
      const py = pyRaw - pan;

      write(roadGroupRef.current, "opacity", "roadO", rT > 0 ? "1" : "0");
      write(
        roadGroupRef.current,
        "transform",
        "roadCam",
        `translate(${(rtx + jx * (1 - K)).toFixed(1)}px, ${(rty + jy * (1 - K) - pan).toFixed(1)}px) scale(${K.toFixed(4)})`,
      );
      // ── The route copy. The headline rises as the truck exits the bend;
      //    the right-hand cards then swap down the south leg, each landing
      //    with a short blue glow that dies as it settles — the reveal. ──────
      const typeE = span(rT, RUN.typeIn, RUN.typeInEnd);
      write(routeLeftRef.current, "opacity", "routeL", typeE.toFixed(3));
      wipeGroup(routeLeftRef.current, typeE);
      write(
        routeLeftRef.current,
        "transform",
        "routeLy",
        `translate3d(0, ${((1 - typeE) * 28).toFixed(1)}px, 0)`,
      );
      for (let i = 0; i < ROUTE_CARDS.length; i++) {
        const el = cardRefs[i].current;
        if (!el) continue;
        const inE = cardInE(rT, i);
        // The blue lives IN the type now — the edge crossing the words —
        // rather than as a halo bloomed around the whole card, which read as
        // a glow effect stuck behind the text.
        wipeGroup(el, inE);
        wipeAccent(el.querySelector<HTMLElement>("[data-card-accent]"), inE, "var(--color-ink)");
        write(el, "opacity", `card${i}o`, cardAlpha(rT, i).toFixed(3));
        write(
          el,
          "transform",
          `card${i}t`,
          `translate3d(0, ${((1 - inE) * 34).toFixed(1)}px, 0)`,
        );
      }

      // ── The overhead vehicle: parked on its mark inside the iris scene
      //    until the run, then riding the sampled route through the SAME
      //    camera the road is drawn with, so it cannot leave the lane. In
      //    the sea act it DRIVES ON: down to the road's end (phase A), then
      //    matching the curtain's climb through the sweep — the container
      //    hangs pinned on screen while its pixels change vehicles.
      const lift = seaCurtainE(sT) * 1.05 * m.stageH;
      let topPose = "";
      if (rT > 0) {
        const bl = runBlendE(rT);
        const X = TILT.topX * m.stageW + (px - TILT.topX * m.stageW) * bl;
        let Y = TILT.topY * m.stageH + (py - TILT.topY * m.stageH) * bl;
        if (sT > 0) {
          const liftA = seaCurtainE(SEA.driveIn[1]) * 1.05 * m.stageH;
          Y +=
            seaDriveAE(sT) * SEA.driveD * m.stageH +
            (sT > SEA.driveIn[1] ? Math.max(0, lift - liftA) : 0);
        }
        const sclFinal = su / TOP_BODY_W / (0.53 * m.stageW);
        const scl = 1 + (sclFinal - 1) * shr;
        topPose =
          `translate(calc(${X.toFixed(1)}px - ${(TOP_BODY_CX * 100).toFixed(4)}%), ` +
          `calc(${Y.toFixed(1)}px - ${(TOP_BODY_CY * 100).toFixed(4)}%)) ` +
          `rotate(${(here.heading * bl).toFixed(2)}deg) scale(${scl.toFixed(4)})`;
      } else if (t > 0) {
        topPose =
          `translate(calc(${(TILT.topX * m.stageW).toFixed(1)}px - ${(TOP_BODY_CX * 100).toFixed(4)}%), ` +
          `calc(${(TILT.topY * m.stageH).toFixed(1)}px - ${(TOP_BODY_CY * 100).toFixed(4)}%))`;
      }
      write(topWrapRef.current, "transform", "topPose", topPose);

      // ── THE SEA. The road world lifts away like a curtain; underneath, the
      //    vessel is already carrying OUR container. The camera pulls back on
      //    the zoom track, the headline and cards land on their marks, the
      //    clouds drift in — and the water lives on gsap's clock, so the sea
      //    keeps moving even when the scroll does not. ────────────────────────
      const curtain = seaCurtainE(sT);
      // The ocean exists ONLY while the sea act does: any earlier and its
      // dark water underlies every act whose layers are transparent.
      write(shipRootRef.current, "visibility", "shipVis", sT > 0.001 ? "visible" : "hidden");
      // The tractor DRIVES OUT: base vehicle (cab + trailer) accelerates on
      // down the lane in sprite space, leaving the stopped container behind,
      // and is cut away by the section's bottom edge as it crosses it.
      const tex = seaTractorE(sT);
      write(
        tractorRef.current,
        "transform",
        "tractor",
        sT > 0 ? `translateX(${(135 * tex * tex).toFixed(1)}%)` : "",
      );
      write(
        topSceneRef.current,
        "transform",
        "curtain",
        curtain > 0 ? `translate3d(0, ${(-curtain * 1.05 * m.stageH).toFixed(1)}px, 0)` : "",
      );
      if (sT > 0) {
        const tm = gsap.ticker.time;
        // THE SIZE SYNC. The handoff zoom is SOLVED, not styled: the hero
        // slot's on-screen width must equal the truck container's on-screen
        // width — same sprite, same size, so the sweep reads as one box
        // changing vehicles. The authored track is only the pull-up's
        // exponent; scale 1 is the video cover-fitting the frame.
        const truckContW = TOP_DECK.h * (su / TOP_BODY_W) * (1536 / 2720);
        const plateW = Math.max(m.stageW, m.stageH * (SHIP_FRAME.w / SHIP_FRAME.h));
        const plateH = plateW * (SHIP_FRAME.h / SHIP_FRAME.w);
        const zBase = truckContW / (SHIP_SLOT.w * plateW);
        // ONE SHOT, ONE CAMERA. The CSS zoom only rides zBase down to
        // exactly cover-fit — its edges can never enter frame — and every
        // metre of altitude past that is BAKED into the footage: the
        // ascent clip, scrubbed by the scroll, whose first frame is the
        // very frame the loop plays. Nothing to crossfade, nothing to
        // mismatch — the water never changes because the shot never does.
        const zoomS = Math.pow(zBase, 1 - seaZoomAt(sT));
        // The scrub: scroll time onto the clip's clock, eased so the rise
        // leaves the deck gently and arrives at altitude braking.
        const ascU = smoother(span(sT, ASC_WIN.in, ASC_WIN.out));
        const ascT = ASCENT.tIn + ascU * (ASCENT.tOut - ASCENT.tIn);
        const av = shipAscentRef.current;
        if (av && av.readyState >= 2 && Math.abs(av.currentTime - ascT) > 0.02) {
          av.currentTime = ascT;
        }
        // The hand-over is an opacity flip between two instants of the SAME
        // shot at the same framing — invisible by construction.
        write(av, "opacity", "ascA", sT > ASC_WIN.in ? "1" : "0");
        // And the LINE SYNC: pan is solved so the slot rides the handoff
        // mark the pinned container hangs on — both axes — easing home to
        // the plate's natural centre before the ascent leaves the deck.
        const panE = seaPanE(sT);
        const panX = -panE * zoomS * (SHIP_SLOT.x - 0.5) * plateW;
        const panY =
          panE * (SEA.handoffY * m.stageH - 0.5 * m.stageH - zoomS * (SHIP_SLOT.y - 0.5) * plateH);
        write(
          shipWrapRef.current,
          "transform",
          "shipW",
          `translate(calc(-50% + ${panX.toFixed(1)}px), calc(-50% + ${panY.toFixed(1)}px)) ` +
            `scale(${zoomS.toFixed(4)})`,
        );
        // The VEYRA box rides the footage's own white column: pose read off
        // the measured ascent track at the scrubbed instant, fading out
        // only once the vessel is a fleck the text could never survive.
        const slot = ascentSlotAt(ascT);
        const heroX = slot.x * plateW - (SHIP_SLOT.w * plateW * slot.s) / 2;
        const heroY = slot.y * plateH - (SHIP_SLOT.len * plateH * slot.s) / 2;
        write(
          shipHeroRef.current,
          "transform",
          "heroT",
          `translate3d(${heroX.toFixed(1)}px, ${heroY.toFixed(1)}px, 0) scale(${slot.s.toFixed(4)})`,
        );
        // The box stays aboard to the very top of the climb — a small white
        // unit on the centreline, exactly as far away as the ship is.
        write(shipHeroRef.current, "opacity", "heroA", "1");
        const typeA = seaTypeE(sT) * (1 - span(sT, 0.7, 0.8));
        write(shipTypeRef.current, "opacity", "shipType", typeA.toFixed(3));
        wipeGroup(shipTypeRef.current, seaTypeE(sT));
        write(
          shipTypeRef.current,
          "transform",
          "shipTypeY",
          `translate3d(0, ${((1 - seaTypeE(sT)) * 30).toFixed(1)}px, 0)`,
        );
        for (let i = 0; i < SHIP_CARDS.length; i++) {
          const el = shipCardRefs[i].current;
          if (!el) continue;
          const inE = seaCardInE(sT, i);
          wipeGroup(el, inE);
          wipeAccent(el.querySelector<HTMLElement>("[data-card-accent]"), inE, "var(--color-paper)");
          write(el, "opacity", `sc${i}o`, seaCardAlpha(sT, i).toFixed(3));
          write(el, "transform", `sc${i}t`, `translate3d(0, ${((1 - inE) * 30).toFixed(1)}px, 0)`);
        }
      }

      // ── THE AIR. The whiteout is BUILT: puffs sail in from BOTH wings
      //    and coverage is their density — the sea survives in the gaps.
      //    Then the freighter crosses, dragging the next section's daylight
      //    in behind its tail, seam hidden under the airframe. ──────────────
      const aT = airT(pin);
      // The weather closes in on the ASCENT's clock, not the air act's: the
      // fleet sails while the drone is still climbing and the last puff is
      // home as the footage tops out — never after it has frozen.
      const cloudsLive = sT > SEA_CLOUD_IN;
      write(
        airRootRef.current,
        "visibility",
        "airVis",
        cloudsLive || aT > 0.001 ? "visible" : "hidden",
      );
      if (cloudsLive) {
        const tmc = gsap.ticker.time;
        for (let i = 0; i < AIR_CLOUDS.length; i++) {
          const el = airCloudRefs[i].current;
          if (!el) continue;
          const c = AIR_CLOUDS[i];
          const e = airCloudE(sT, i, AIR_CLOUDS.length);
          const wPx = c.w * m.stageW;
          // From its wing to its OWN post — spread across the frame, the
          // centre corridor left open so the vessel keeps its window.
          const rest = c.cx * m.stageW - wPx / 2;
          const from = c.side < 0 ? -wPx * 1.15 : m.stageW + wPx * 0.15;
          const x = from + (rest - from) * e + Math.sin(tmc * 0.05 + i * 1.7) * 14;
          const y = (c.y - 0.5) * m.stageH * (1.04 - 0.04 * e) + 0.5 * m.stageH;
          write(
            el,
            "transform",
            `acl${i}`,
            `translate3d(${x.toFixed(1)}px, calc(${y.toFixed(1)}px - 50%), 0) ` +
              `scale(${(0.94 + 0.1 * e).toFixed(3)})`,
          );
          write(el, "opacity", `aclo${i}`, Math.min(1, e * 1.6).toFixed(3));
        }
      }
      if (aT > 0) {
        const tma = gsap.ticker.time;
        // The crossing and its cargo: the seam rides under the tail, so the
        // panel's x is a pure function of the freighter's.
        const u = airPlaneU(aT);
        const planeEl = airPlaneRef.current;
        const planeW = planeEl ? planeEl.offsetWidth : 2.03 * m.stageH;
        // In from off-screen left, out to the right with only its tail left
        // in frame: the freighter leaves, the daylight it towed stays.
        const planeX = -planeW + u * (m.stageW + (1 - PLANE_EXIT) * planeW);
        write(
          planeEl,
          "transform",
          "planeT",
          // The bob stays inside the seam solve's margin — any deeper and
          // the wing gap could clear the frame edge and leak the seam.
          `translate3d(${planeX.toFixed(1)}px, calc(-50% + ${(Math.sin(tma * 0.5) * 4).toFixed(1)}px), 0)`,
        );
        // The daylight is REVEALED, not slid: a clip whose right edge is
        // the seam, so the section's own opening screen is already in its
        // final place the whole way across — nothing to re-align at release.
        const seamX = planeX + PLANE_SEAM * planeW;
        write(
          airPanelRef.current,
          "clip-path",
          "panelClip",
          `inset(0 ${Math.max(0, m.stageW - seamX).toFixed(1)}px 0 0)`,
        );
        // The instruments belong to the journey, not to the client page the
        // freighter is towing in: they go out with the water behind them.
        write(
          hudRef.current,
          "opacity",
          "hudA",
          (1 - clamp01(seamX / (0.45 * m.stageW))).toFixed(3),
        );
      }

      // ── Copy and instruments ───────────────────────────────────────────────
      write(copyWrapRef.current, "opacity", "copy", bandOpacity(p).toFixed(3));
      // The chapter's own words take the wipe on the band's RISING edge, so
      // the reveal happens while the block fades in rather than after it.
      const bandIn = span(p, BAND.in, BAND.up);
      wipeGroup(headlineRef.current, bandIn);
      wipeGroup(panelRef.current, bandIn);
      wipeGroup(exitRef.current, span(p, BEAT.run, BEAT.run + 0.05));
      // Ink until the sea takes the frame: the curtain lift is what puts dark
      // water under the instruments, so it is what flips them to paper.
      write(
        eyebrowToneRef.current,
        "color",
        "eyebrowTone",
        toneColor(Math.max(splitTone(pin), curtain)),
      );
      write(
        barRef.current,
        "transform",
        "bar",
        `scaleX(${clamp01(hudSpeedKmh(pin) / 95).toFixed(3)})`,
      );
    };

    const ctx = gsap.context(() => {
      measure();

      const drive = gsap.to(progressRef.current, {
        p: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          // One pin, five acts: 11 viewports of yard story (unchanged pacing
          // — storyQ maps them back onto the approved 0..1), 3 of the cut to
          // overhead, 7 of the run, 4 of the sea, and 5 of the air.
          end: "+=3000%",
          pin: stage,
          anticipatePin: 1,
          scrub: 0.45,
          invalidateOnRefresh: true,
          onRefresh: measure,
          onUpdate: (self) => {
            const next =
              self.progress > ACTS.sea + 0.025
                ? 3
                : self.progress > ACTS.run + 0.025
                  ? 2
                  : chapterFor(storyQ(self.progress));
            setChapter((prev) => (prev === next ? prev : next));
          },
        },
      });

      render();
      gsap.ticker.add(render);

      return () => {
        gsap.ticker.remove(render);
        drive.scrollTrigger?.kill();
        drive.kill();
      };
    }, section);

    const observer = new ResizeObserver(() => {
      measure();
      last.clear();
      render();
    });
    observer.observe(stage);
    // The strip's width settles when the display face finishes loading — its
    // travel map must be restated from the real content width when it does.
    if (stripRef.current) observer.observe(stripRef.current);
    if (ghostRef.current) observer.observe(ghostRef.current);

    const progress = progressRef.current;

    return () => {
      observer.disconnect();
      ctx.revert();
      progress.p = 0;
    };
  }, [live]);

  // Chapter hand-off. The headline and eyebrow are keyed, so React hands us a
  // pristine node and the destructive split never fights reconciliation.
  useEffect(() => {
    if (!live || chapter < 0) return;

    const headline = headlineRef.current;
    const eyebrow = eyebrowRef.current;
    if (!headline) return;

    const ctx = gsap.context(() => {
      // Masked split, wipe-ready: the same nodes carry the rise AND the
      // ticker's wipe, so neither owner re-splits the other's targets.
      const lines = prepareWipe(headline, { mask: true });
      gsap.from(lines, {
        yPercent: 108,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.06,
      });
      if (eyebrow) scrambleText(eyebrow, { duration: 0.6 });
      if (panelRef.current) {
        gsap.fromTo(
          panelRef.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
        );
      }
    });

    return () => {
      ctx.revert();
      revertSplit(headline);
    };
  }, [chapter, live]);

  const active = CHAPTERS[Math.max(0, chapter)];
  const [terminal, land] = CHAPTERS;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="yard-heading"
      data-reveal-skip
      /* z-10 so the pinned stage stays above the client section overlapped
         beneath its last viewport — the reveal is the plane's, not a
         stacking accident. */
      className="relative z-10 bg-paper text-ink"
    >
      <h2 id="yard-heading" className="sr-only">
        From the stack to the road
      </h2>

      <div
        ref={stageRef}
        className="yard-live relative h-[100svh] w-full overflow-hidden bg-paper"
        /* The tilt's rotateX reads as a camera move only under a lens: this is
           the vanishing depth for the side world laying back. */
        style={{ perspective: "1400px" }}
      >
        <div
          ref={groundLayerRef}
          aria-hidden="true"
          className="absolute inset-0 z-0 opacity-0"
          style={{
            background:
              "radial-gradient(120% 95% at 50% 38%, #F3F3F1 0%, #E6E6E3 58%, #D7D7D3 100%)",
          }}
        />

        {/* THE SEA — waiting under everything that lifts away: earlier in the
            DOM than the road world, so the curtain reveal is pure paint
            order. */}
        <ShipScene
          rootRef={shipRootRef}
          wrapRef={shipWrapRef}
          ascentRef={shipAscentRef}
          heroRef={shipHeroRef}
          typeRef={shipTypeRef}
          cardRefs={shipCardRefs}
        />

        {/* THE AIR — above the sea in the DOM and in the story: the puff
            fleet builds the whiteout, then the freighter drags in daylight. */}
        <AirScene
          rootRef={airRootRef}
          cloudRefs={airCloudRefs}
          panelRef={airPanelRef}
          planeRef={airPlaneRef}
        />

        <SplitStage progress={() => progressRef.current.p} className="z-[1]" />

        {/* The roadside strip rides ON the night band (later in the DOM at the
            same depth) and UNDER the vehicle layers — the truck passes in
            front of the ghost type, exactly like the reference. */}
        <FollowStrip ghostRef={ghostRef} stripRef={stripRef} />

        {/* THE TOP SCENE — a complete overhead page of its own: paper, the
            tarmac band, streaming lane dashes, the junction network (hidden
            until the run) and the loaded truck from above. The whole layer is
            gated by a clip-path circle the ticker widens — the iris the cut
            opens through. The side world (z-2) still draws over it while its
            truck clears frame right. */}
        <div
          ref={topSceneRef}
          aria-hidden="true"
          className="absolute inset-0 z-[1]"
          style={{ clipPath: "circle(0% at 50% 52%)" }}
        >
          <div className="absolute inset-0 bg-paper" />
          <div
            ref={topBandRef}
            className="absolute inset-x-0 bg-night"
            style={{ top: pct(TILT.seamEnd), bottom: pct(1 - TILT.bottom) }}
          />
          {/* The band's lane lines ARE the network's, one for one: the SVG
              draws 0.022-unit strokes dashed 0.34/0.30, and at the handoff
              camera one road unit is bandHeight/ROAD_WIDTH of the viewport —
              so these dashes are authored at exactly that: 3.01svh thick,
              46.57svh long, 41.09svh apart, white at 0.88. The swap to the
              network changes nothing but who is drawing. */}
          <div ref={lanesRef} className="absolute inset-0 will-change-transform">
            {TILT.rows.map((row) => (
              <div
                key={row}
                className="absolute left-[-87.66svh] flex w-max -translate-y-1/2 gap-[41.09svh]"
                style={{ top: pct(row) }}
              >
                {Array.from({ length: 6 }, (_, i) => (
                  <span
                    key={i}
                    className="h-[3.01svh] w-[46.57svh] shrink-0 bg-white/[0.88]"
                  />
                ))}
              </div>
            ))}
          </div>
          <div ref={topLayerRef} className="absolute inset-0">
            <RoadPath groupRef={roadGroupRef} />
            <TruckTopRig wrapRef={topWrapRef} tractorRef={tractorRef} />
          </div>
          {/* The south run's flanking copy, screen-space over the network. */}
          <RouteContent leftRef={routeLeftRef} cardRefs={cardRefs} />
        </div>

        <div
          ref={sideLayerRef}
          aria-hidden="true"
          className="absolute inset-0 z-[2] will-change-transform"
          /* The follow's affine is stated about a point ON the ground line:
             scale leaves the ground put, dy IS the seam move, and the tilt's
             rotateX hinges about the same line. */
          style={{ transformOrigin: `50% ${(STAGE.ground * 100).toFixed(2)}%` }}
        >
          {/* One world box, one aspect ratio. Every measured fraction in
              geometry.ts is a percentage of this element, so the whole
              composition survives resize without a single measured offset. */}
          <div
            ref={worldRef}
            /* One stage scale and one vertical anchor, both authored in
               geometry.ts. The width is what sets every vehicle's share of the
               viewport; `top` puts the world's ground line at STAGE.ground and
               the translate cancels the world's own offset to it, so the anchor
               holds at any aspect — and SplitStage paints its seam from the same
               constant, which is why the tyres land on it. */
            className="absolute left-1/2 w-[var(--stage-w)] md:w-[var(--stage-w-md)]"
            style={
              {
                "--stage-w": STAGE.widthNarrow,
                "--stage-w-md": STAGE.width,
                top: pct(STAGE.ground),
                aspectRatio: `${WORLD.w} / ${WORLD.h}`,
                transform: `translate(-50%, ${(-GROUND.truck * 100).toFixed(4)}%)`,
              } as CSSProperties
            }
          >
            {/* Horizon, pushed past the world edges so nothing reveals an end. */}
            <span
              className="absolute"
              style={{
                left: "-30%",
                width: "160%",
                top: pct(GROUND.truck),
                height: 1,
                background:
                  "linear-gradient(90deg, rgba(17,17,17,0) 0%, rgba(17,17,17,0.16) 20%, rgba(17,17,17,0.16) 80%, rgba(17,17,17,0) 100%)",
              }}
            />

            {/* The stack: two door faces, with the hero box resting on their
                top face until the pick. */}
            <DoorStack />

            <span
              ref={boxShadowRef}
              className="absolute top-0 left-0 origin-center will-change-transform"
              style={{
                width: pct(BOX_SHADOW_W),
                height: pct(0.022),
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.3) 0%, rgba(17,17,17,0.12) 46%, rgba(17,17,17,0) 74%)",
              }}
            />

            {/* Depth order is the ground line: the machine's lane is authored
                downstage of the truck's, so the rig draws in FRONT of the
                trailer it loads, never inside it. */}
            <TruckRig bodyRef={truckBodyRef} wheelRefs={wheelRefs} />
            <CraneRig
              bodyRef={craneBodyRef}
              boomRef={boomRef}
              boomHeadRef={boomHeadRef}
              shadowRef={craneShadowRef}
              wheelRefs={craneWheelRefs}
            />

            {/* The hero box. One element for the whole timeline — never
                duplicated, never swapped; only its parent changes. ABOVE the
                boom (LAYER.box): the reference's carry frames show the arm
                passing BEHIND the container, with only the spreader (z 11/12)
                in front of its roof. Sway hinges at the grip point. */}
            <VeyraBox
              boxRef={boxRef}
              className="will-change-transform"
              style={{
                width: pct(BOX_W),
                height: pct(BOX_H),
                zIndex: LAYER.box,
                transformOrigin: `${BOX_SWAY_ORIGIN.xPct.toFixed(2)}% ${BOX_SWAY_ORIGIN.yPct.toFixed(2)}%`,
              }}
            />

            {/* Cable and beam, hung from the boom head computed in the same
                frame — z 11/12, over the box they handle. */}
            <SpreaderRig spreaderRef={spreaderRef} cableRef={cableRef} />

          </div>
        </div>

        {/* Top padding clears the fixed header, which floats over the pin. */}
        <div
          ref={hudRef}
          className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-5 pt-24 sm:p-8 sm:pt-24 lg:p-14 lg:pt-28"
        >
          <div className="flex items-start justify-between gap-6">
            <SpeedReadout
              getSpeed={() => hudSpeedKmh(progressRef.current.p)}
              getDistance={() => hudDistanceKm(progressRef.current.p)}
              tone={() =>
                Math.max(
                  splitTone(progressRef.current.p),
                  seaCurtainE(seaT(progressRef.current.p)),
                )
              }
              barRef={barRef}
            />
            {/* Stable wrapper carries the tone; the keyed child carries the
                scramble, so a chapter remount cannot strand a colour write. */}
            <span
              ref={eyebrowToneRef}
              className="font-mono text-[10px] tracking-[0.24em] text-ink uppercase opacity-60 sm:text-[11px]"
            >
              <span key={chapter} ref={eyebrowRef}>
                {active.eyebrow}
              </span>
            </span>
          </div>

          <div
            ref={copyWrapRef}
            className="flex flex-col gap-7 opacity-0 lg:flex-row lg:items-end lg:justify-between lg:gap-16"
          >
            <p
              key={chapter}
              ref={headlineRef}
              /* Sized to clear the chassis: at the old 6.4vw the two lines
                 stood tall enough to print over the truck's wheels, because
                 the copy row is bottom-anchored and grows upward. */
              className="u-display max-w-[15ch] text-[clamp(1.75rem,4.4vw,3.9rem)] leading-[1.02]"
            >
              {terminal.headline}
            </p>

            <div ref={panelRef} className="w-full border-t border-ink/15 pt-4 lg:max-w-sm">
              <span className="block font-mono text-[11px] tracking-[0.28em] text-signal uppercase">
                {terminal.label}
              </span>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70 sm:text-base">
                {terminal.copy}
              </p>
            </div>
          </div>
        </div>

        <div
          ref={exitRef}
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 p-5 opacity-0"
          /* The overhead run is still fading out under this card, so the
             sign-off carries its own paper wash rather than sitting on tarmac. */
          style={{
            background:
              "radial-gradient(62% 46% at 50% 50%, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.78) 58%, rgba(255,255,255,0) 100%)",
          }}
        >
          <p className="u-display text-center text-[clamp(2.4rem,8vw,7rem)]">Delivered. Every time.</p>
          {/* The linehaul caption signs the section off here, where it has the
              frame to itself, rather than fighting the overhead run's type. */}
          <div className="max-w-md border-t border-ink/15 pt-4 text-center">
            <span className="block font-mono text-[11px] tracking-[0.28em] text-signal uppercase">
              {land.label}
            </span>
            <p className="mt-3 text-sm leading-relaxed text-ink/70 sm:text-base">{land.copy}</p>
          </div>
        </div>
      </div>

      <YardStory />
    </section>
  );
}
