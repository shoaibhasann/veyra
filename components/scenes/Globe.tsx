"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DynamicDrawUsage,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  BackSide,
} from "three";

import {
  DEG2RAD,
  MARKERS,
  REST_CENTER_LNG,
  centerLongitude,
  latLngToVector3,
  resolveRoutes,
} from "@/lib/globe/coords";
import { buildArcNetwork, buildMarkerField, greatCircleArc } from "@/lib/globe/arcs";
import { COASTLINES } from "@/lib/globe/coastlines";
import { buildDotField } from "@/lib/globe/dots";
import { createLandMask, type LandMask } from "@/lib/globe/landmask";
import {
  frontFacingRuns,
  projectOrtho,
  type OrthoView,
} from "@/lib/globe/orthographic";
import {
  ARC_FRAGMENT,
  ARC_VERTEX,
  ATMOSPHERE_VERTEX,
  DOT_FRAGMENT,
  DOT_VERTEX,
  GLOW_FRAGMENT,
  HEAD_FRAGMENT,
  HEAD_VERTEX,
  INNER_GLOW_FRAGMENT,
  MARKER_FRAGMENT,
  MARKER_VERTEX,
} from "@/lib/globe/shaders";

/* Sunrise lighting — the two rim colours. */
const COLOR_RIM_SUNRISE = "#ff7a2f"; // warm glow, strongest on the upper limb
const COLOR_RIM_DEEP = "#1e5eff"; // deep blue wash along the lower limb

const COLOR_DOT = "#ffffff";
const COLOR_MARKER = "#ff8a3d";
const COLOR_ARC = "#ff7a2f";
const COLOR_ARC_HEAD = "#ffd7b8";

const GLOBE_RADIUS = 1;
/**
 * Opaque planet body, a hair under the dot shell. It writes depth, so the far
 * hemisphere's dots/arcs/markers are occluded by the z-buffer automatically —
 * the planet reads solid instead of a glass ball full of dots.
 */
const CORE_RADIUS = GLOBE_RADIUS * 0.992;
const COLOR_CORE = "#06080d";
/**
 * Dot field. The grid step lives in lib/globe/dots.ts (1.1° -> ~12.5k dots);
 * these two control how each dot renders: slightly oversized pure-white
 * points, with the night side floored so the matrix never vanishes.
 */
const DOT_SIZE = 0.017; // world-ish units, scaled by viewport in resize()
const DOT_DARK_FLOOR = 0.6; // unlit-face alpha floor (lit face is 1.0)

/**
 * Atmosphere — two additive shells (see shaders.ts), both with depth fully
 * disabled and renderOrder 0 so the opaque core cannot eat them:
 *
 *  (a) INNER  FrontSide at 1R    faint back-lit band just inside the limb
 *  (b) GLOW   BackSide  at 1.12R ONE continuous limb-anchored field: a hot
 *                                narrow line peaking exactly AT the planet
 *                                limb (near-white crown, orange upper sides,
 *                                blue below) plus a wide soft bloom reaching
 *                                ~12% past the silhouette, both decaying to
 *                                exactly zero at the shell's geometric edge —
 *                                so no shell silhouette can ever print.
 */
const ATMO_GLOW_RADIUS = 1.12;
const ATMO_RIM_FALLOFF = 12.0; // hot line: fast exponential decay off the limb
const ATMO_RIM_INTENSITY = 1.3;
const ATMO_CREST = "#fff3e2"; // near-white heat at the top of the crown
const ATMO_HALO_FALLOFF = 5.0; // exponential decay across the wide bloom band
const ATMO_HALO_INTENSITY = 0.68;
const ATMO_HALO_TOP = "#ff8a3a"; // orange bloom over the upper hemisphere
const ATMO_HALO_BOTTOM = "#2e63f0"; // rich blue (#2456E6..#4A8CFF family)
const ATMO_INNER_POWER = 2.6;
const ATMO_INNER_INTENSITY = 0.5;
const CAMERA_FOV = 30;
/**
 * World units the camera keeps in frame: globe plus its glow shells. The
 * globe silhouette lands at 80% (2R / FRAME_EXTENT) of the container's
 * shorter side, so the hero's ~113vh square box yields a ~90vh planet with
 * the 1.12R halo fully in frame and no wasted offscreen render.
 */
const FRAME_EXTENT = 2.5;
const AXIAL_TILT = -0.22;
const SPIN_SPEED = (Math.PI * 2) / 100; // one revolution ≈ 100s
const PARALLAX_YAW = 0.2;
const PARALLAX_PITCH = 0.14;
const ARC_SPEED = 0.16;
const MOBILE_BREAKPOINT = 768;

/** Key light: screen-up with a push toward camera — the sunrise direction. */
const LIGHT_DIR = new Vector3(0.18, 0.8, 0.55).normalize();

/** Labels fade as their surface normal turns away from camera. */
const LABEL_FADE_LO = 0.15;
const LABEL_FADE_HI = 0.32;
const LABEL_LIFT_PX = 10;
/**
 * Labels also fade as their anchor nears the VIEWPORT edge (the hero's globe
 * box bleeds offscreen right, so the browser edge — not the container — is
 * what clips). A pill either fits fully inside the viewport with this inset,
 * or it has faded to 0 by the time it would clip; we never clamp a pill away
 * from its dot.
 */
const LABEL_EDGE_INSET_PX = 16;
const LABEL_EDGE_FADE_PX = 48;

type Mode = "idle" | "webgl" | "static";

/* ------------------------------------------------------------------ *
 * Static fallback — pure geometry, no canvas, no WebGL, no labels.
 * Projected once at module load so server and client emit identical
 * markup (coordinates are rounded to 2dp to stay clear of ULP drift).
 * ------------------------------------------------------------------ */

const SVG_SIZE = 320;
const SVG_R = 128;
const SVG_C = SVG_SIZE / 2;

const round2 = (n: number) => Math.round(n * 100) / 100;

const FALLBACK_VIEW: OrthoView = {
  centerLng: REST_CENTER_LNG,
  tilt: AXIAL_TILT,
  cx: SVG_C,
  cy: SVG_C,
  radius: SVG_R,
};

/**
 * Land test in lng/lat space over the same rings the WebGL mask rasterises.
 * The canvas sampler is client-only, so module scope re-derives it as pure
 * maths: union of per-ring ray casts, which matches the rasteriser's
 * fill-per-ring union (rings may overlap, so no even-odd across rings).
 */
const FALLBACK_RINGS = COASTLINES.map((ring) => {
  const lngs: number[] = [];
  const lats: number[] = [];
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    const lng = ring[i];
    const lat = ring[i + 1];
    lngs.push(lng);
    lats.push(lat);
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { lngs, lats, minLng, maxLng, minLat, maxLat };
});

function fallbackIsLand(lat: number, lng: number): boolean {
  for (const ring of FALLBACK_RINGS) {
    if (
      lat < ring.minLat ||
      lat > ring.maxLat ||
      lng < ring.minLng ||
      lng > ring.maxLng
    ) {
      continue;
    }
    const { lngs, lats } = ring;
    let inside = false;
    for (let i = 0, j = lngs.length - 1; i < lngs.length; j = i++) {
      if (
        lats[i] > lat !== lats[j] > lat &&
        lng < ((lngs[j] - lngs[i]) * (lat - lats[i])) / (lats[j] - lats[i]) + lngs[i]
      ) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

/**
 * Dot-matrix continents — the WebGL field's equal-angle lat/lng grid at SVG
 * scale (2.2° -> ~1.6k visible dots), batched into one <path> per brightness
 * band so the whole matrix costs a handful of DOM nodes. Rows sit on
 * latitude rings like the WebGL field, giving the same airy spacing feel;
 * bands run dim lower-left to bright upper-right, matching the sunrise key
 * light, with a high floor so the night side stays clearly visible.
 */
const DOT_STEP_DEG = 2.2;
const DOT_R = 0.7;
const DOT_BANDS = [0.55, 0.66, 0.78, 0.9, 1] as const;

const FALLBACK_DOT_PATHS: string[] = (() => {
  const paths = DOT_BANDS.map(() => "");
  const v = new Vector3();

  const rows = Math.round(180 / DOT_STEP_DEG);
  const cols = Math.round(360 / DOT_STEP_DEG);
  const latStep = 180 / rows;
  const lngStep = 360 / cols;

  for (let row = 0; row < rows; row++) {
    const lat = -90 + (row + 0.5) * latStep;
    const lngOffset = row % 2 === 0 ? 0 : lngStep / 2;

    for (let col = 0; col < cols; col++) {
      const lng = -180 + lngOffset + col * lngStep;
      if (!fallbackIsLand(lat, lng)) continue;

      const p = projectOrtho(latLngToVector3(lat, lng, 1, v), FALLBACK_VIEW);
      if (p.z <= 0.02) continue;

      const light = 0.5 + (p.x - SVG_C - (p.y - SVG_C)) / (2 * SVG_R);
      const band = Math.min(
        DOT_BANDS.length - 1,
        Math.max(0, Math.floor(light * DOT_BANDS.length)),
      );
      paths[band] +=
        `M${round2(p.x - DOT_R)} ${p.y}` +
        `a${DOT_R} ${DOT_R} 0 1 0 ${DOT_R * 2} 0` +
        `a${DOT_R} ${DOT_R} 0 1 0 ${-DOT_R * 2} 0`;
    }
  }

  return paths;
})();

/** A few hero lanes only — the full network is the WebGL scene's job. */
const FALLBACK_ROUTES: readonly (readonly [string, string])[] = [
  ["IN", "AE"],
  ["CN", "AU"],
  ["AE", "DE"],
];

const FALLBACK_ARCS: string[] = resolveRoutes(FALLBACK_ROUTES).flatMap(
  ({ from, to }) =>
    frontFacingRuns(
      greatCircleArc(from, to, GLOBE_RADIUS).getPoints(36),
      FALLBACK_VIEW,
      false,
    ),
);

const FALLBACK_MARKERS = MARKERS.map((marker) => {
  const p = projectOrtho(
    latLngToVector3(marker.lat, marker.lng, GLOBE_RADIUS),
    FALLBACK_VIEW,
  );
  return { code: marker.code, x: p.x, y: p.y, visible: p.z > 0 };
}).filter((m) => m.visible);

function StaticGlobe({ hidden }: { hidden: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{
        gridArea: "1 / 1",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        opacity: hidden ? 0 : 1,
        transition: "opacity 700ms ease",
        pointerEvents: "none",
      }}
    >
      <defs>
        <radialGradient id="veyra-globe-body" cx="50%" cy="68%" r="78%">
          <stop offset="0%" stopColor={COLOR_RIM_DEEP} stopOpacity="0.22" />
          <stop offset="60%" stopColor={COLOR_RIM_DEEP} stopOpacity="0.07" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="veyra-globe-sunrise" cx="50%" cy="6%" r="75%">
          <stop offset="0%" stopColor={COLOR_RIM_SUNRISE} stopOpacity="0.34" />
          <stop offset="55%" stopColor={COLOR_RIM_SUNRISE} stopOpacity="0.06" />
          <stop offset="100%" stopColor={COLOR_RIM_SUNRISE} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="veyra-globe-rim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={COLOR_RIM_SUNRISE} stopOpacity="0.95" />
          <stop offset="48%" stopColor={COLOR_RIM_SUNRISE} stopOpacity="0.3" />
          <stop offset="100%" stopColor={COLOR_RIM_DEEP} stopOpacity="0.8" />
        </linearGradient>
        <clipPath id="veyra-globe-clip">
          <circle cx={SVG_C} cy={SVG_C} r={SVG_R} />
        </clipPath>
      </defs>

      <circle cx={SVG_C} cy={SVG_C} r={SVG_R} fill={COLOR_CORE} />
      <circle cx={SVG_C} cy={SVG_C} r={SVG_R} fill="url(#veyra-globe-body)" />
      <circle cx={SVG_C} cy={SVG_C} r={SVG_R} fill="url(#veyra-globe-sunrise)" />

      {FALLBACK_DOT_PATHS.map((d, i) =>
        d ? (
          <path key={`d${i}`} d={d} fill={COLOR_DOT} fillOpacity={DOT_BANDS[i]} />
        ) : null,
      )}

      <circle
        cx={SVG_C}
        cy={SVG_C}
        r={SVG_R}
        fill="none"
        stroke="url(#veyra-globe-rim)"
        strokeWidth="1.4"
        strokeOpacity="0.9"
      />

      <g clipPath="url(#veyra-globe-clip)">
        {FALLBACK_ARCS.map((d, i) => (
          <path
            key={`a${i}`}
            d={d}
            fill="none"
            stroke={COLOR_ARC}
            strokeOpacity="0.55"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        ))}
      </g>

      {FALLBACK_MARKERS.map((m) => (
        <g key={m.code}>
          <circle cx={m.x} cy={m.y} r="4.5" fill={COLOR_MARKER} fillOpacity="0.18" />
          <circle cx={m.x} cy={m.y} r="1.7" fill={COLOR_MARKER} />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * WebGL scene
 * ------------------------------------------------------------------ */

/** Builds the whole scene and returns its teardown. */
function buildScene(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  mask: LandMask,
  labels: readonly (HTMLDivElement | null)[],
  onFirstFrame: () => void,
): () => void {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);

  // parallax (pointer) -> tilt (fixed) -> spin (auto-rotate)
  const parallax = new Group();
  const tilt = new Group();
  const spin = new Group();
  tilt.rotation.z = AXIAL_TILT;
  spin.rotation.y = centerLongitude(REST_CENTER_LNG);
  parallax.add(tilt);
  tilt.add(spin);
  scene.add(parallax);

  // --- opaque planet body ---------------------------------------------
  // Rendered in three's opaque pass (before every transparent layer) with
  // depthWrite on: everything on the far hemisphere fails the depth test and
  // vanishes, exactly like a real planet limb.
  const coreGeometry = new SphereGeometry(CORE_RADIUS, 64, 48);
  const coreMaterial = new MeshBasicMaterial({
    color: new Color(COLOR_CORE),
    depthTest: true,
    depthWrite: true,
  });
  const core = new Mesh(coreGeometry, coreMaterial);
  core.renderOrder = 0;
  // A uniform sphere — parenting to `spin` would be invisible; keep it static.
  scene.add(core);

  // --- dot matrix ---------------------------------------------------
  const dotField = buildDotField(mask, { radius: GLOBE_RADIUS });
  const dotGeometry = new BufferGeometry();
  dotGeometry.setAttribute("position", new BufferAttribute(dotField.positions, 3));
  dotGeometry.setAttribute("aSeed", new BufferAttribute(dotField.seeds, 1));

  const dotMaterial = new ShaderMaterial({
    vertexShader: DOT_VERTEX,
    fragmentShader: DOT_FRAGMENT,
    transparent: true,
    depthTest: true, // far-side dots are hidden by the core's depth buffer
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 400 },
      uDotSize: { value: DOT_SIZE },
      uFloor: { value: DOT_DARK_FLOOR },
      uLightDir: { value: LIGHT_DIR.clone() },
      uColor: { value: new Color(COLOR_DOT) },
    },
  });

  const dots = new Points(dotGeometry, dotMaterial);
  dots.frustumCulled = false;
  dots.renderOrder = 1;
  spin.add(dots);

  // --- lanes ---------------------------------------------------------
  const network = buildArcNetwork({ radius: GLOBE_RADIUS });
  const arcGeometry = new BufferGeometry();
  arcGeometry.setAttribute("position", new BufferAttribute(network.positions, 3));
  arcGeometry.setAttribute("aProgress", new BufferAttribute(network.progress, 1));
  arcGeometry.setAttribute("aPhase", new BufferAttribute(network.phases, 1));

  const arcMaterial = new ShaderMaterial({
    vertexShader: ARC_VERTEX,
    fragmentShader: ARC_FRAGMENT,
    transparent: true,
    depthTest: true, // arcs dive behind the limb naturally
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: ARC_SPEED },
      uTrail: { value: 0.1 },
      uBase: { value: 0.18 },
      uLineColor: { value: new Color(COLOR_ARC) },
      uHeadColor: { value: new Color(COLOR_ARC_HEAD) },
    },
  });

  const arcs = new LineSegments(arcGeometry, arcMaterial);
  arcs.frustumCulled = false;
  arcs.renderOrder = 2;
  spin.add(arcs);

  // --- travelling heads ---------------------------------------------
  const headPositions = new Float32Array(network.curves.length * 3);
  const headGeometry = new BufferGeometry();
  const headAttribute = new BufferAttribute(headPositions, 3);
  headAttribute.setUsage(DynamicDrawUsage);
  headGeometry.setAttribute("position", headAttribute);

  const headMaterial = new ShaderMaterial({
    vertexShader: HEAD_VERTEX,
    fragmentShader: HEAD_FRAGMENT,
    transparent: true,
    depthTest: true, // heads vanish behind the limb with their arcs
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uSize: { value: 15 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color(COLOR_ARC_HEAD) },
    },
  });

  const heads = new Points(headGeometry, headMaterial);
  heads.frustumCulled = false;
  heads.renderOrder = 4;
  spin.add(heads);

  // --- country markers ------------------------------------------------
  const markerField = buildMarkerField(MARKERS, GLOBE_RADIUS * 1.004);
  const markerGeometry = new BufferGeometry();
  markerGeometry.setAttribute("position", new BufferAttribute(markerField.positions, 3));
  markerGeometry.setAttribute("aPhase", new BufferAttribute(markerField.phases, 1));

  const markerMaterial = new ShaderMaterial({
    vertexShader: MARKER_VERTEX,
    fragmentShader: MARKER_FRAGMENT,
    transparent: true,
    depthTest: true, // far-side markers are occluded by the core
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.45 },
      uSize: { value: 30 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color(COLOR_MARKER) },
    },
  });

  const markers = new Points(markerGeometry, markerMaterial);
  markers.frustumCulled = false;
  markers.renderOrder = 3;
  spin.add(markers);

  // --- atmosphere: inner edge light + combined limb glow -----------------
  // Two shells sharing one unit-sphere geometry, scaled per shell. depthTest
  // stays OFF on both: the BackSide shell's fragments sit *behind* the opaque
  // core in depth (testing would erase the glow), and the transparent pass
  // runs after the opaque core anyway. renderOrder 0 keeps both shells under
  // the dots/arcs within that pass, and additive blending makes their mutual
  // order irrelevant. Neither parents to `spin` — the glow is a lens effect,
  // it must not rotate.
  const shellGeometry = new SphereGeometry(1, 64, 48);

  // (a) faint back-lit band just INSIDE the limb, so the unlit face doesn't
  // read as a flat black cutout. FrontSide: it paints the planet's near face.
  const innerGlowMaterial = new ShaderMaterial({
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: INNER_GLOW_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColorTop: { value: new Color(COLOR_RIM_SUNRISE) },
      uColorBottom: { value: new Color(COLOR_RIM_DEEP) },
      uPower: { value: ATMO_INNER_POWER },
      uIntensity: { value: ATMO_INNER_INTENSITY },
    },
  });
  const innerGlow = new Mesh(shellGeometry, innerGlowMaterial);
  innerGlow.scale.setScalar(GLOBE_RADIUS);
  innerGlow.renderOrder = 0;
  scene.add(innerGlow);

  // (b) ONE continuous glow field: hot narrow line peaking exactly at the
  // planet limb plus the wide soft bloom, composed in a single shell so
  // there is no seam between "rim" and "halo" by construction. Both terms
  // decay to exactly zero at the shell's geometric edge, so the shell's own
  // silhouette can never print as a circle. uLimb is the constant Rp/Rh:
  // the shader's `s` equals (ray impact parameter)/Rh for every fragment —
  // |n̂×û| = |C×û|/Rh because (P−O)×û = 0 — and the visible limb IS the
  // tangent ray, impact parameter exactly Rp, at ANY camera distance. No
  // resize dependence; a per-distance "correction" here is what printed a
  // detached ring with a dark gap off the limb.
  const glowMaterial = new ShaderMaterial({
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
    uniforms: {
      uRimTop: { value: new Color(COLOR_RIM_SUNRISE) },
      uRimBottom: { value: new Color(COLOR_RIM_DEEP) },
      uRimCrest: { value: new Color(ATMO_CREST) },
      uHaloTop: { value: new Color(ATMO_HALO_TOP) },
      uHaloBottom: { value: new Color(ATMO_HALO_BOTTOM) },
      uLimb: { value: GLOBE_RADIUS / ATMO_GLOW_RADIUS },
      uRimFalloff: { value: ATMO_RIM_FALLOFF },
      uHaloFalloff: { value: ATMO_HALO_FALLOFF },
      uRimIntensity: { value: ATMO_RIM_INTENSITY },
      uHaloIntensity: { value: ATMO_HALO_INTENSITY },
    },
  });
  const glow = new Mesh(shellGeometry, glowMaterial);
  glow.scale.setScalar(ATMO_GLOW_RADIUS);
  glow.renderOrder = 0;
  scene.add(glow);

  // --- sizing ----------------------------------------------------------
  const baseDistance = FRAME_EXTENT / 2 / Math.tan((CAMERA_FOV * DEG2RAD) / 2);
  let viewWidth = 0;
  let viewHeight = 0;

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    viewWidth = width;
    viewHeight = height;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    // Portrait boxes are width-limited, so pull back by the aspect deficit.
    camera.position.z =
      camera.aspect < 1 ? baseDistance / camera.aspect : baseDistance;
    camera.updateProjectionMatrix();

    // uLimb stays the constant Rp/Rh set at material creation: the shader's
    // `s` is the ray's impact parameter over Rh, and the visible limb is the
    // planet-tangent ray (impact parameter Rp) at every camera distance, so
    // there is nothing distance-dependent to update here. The old formula —
    // sin of the exit point's CENTRAL angle, (Rp·cosβ + sinβ·√(Rh²−Rp²))/Rh —
    // answered a different question and pushed the whole field outward,
    // printing a dark gap ring between the dot limb and the glow.

    // Drawing-buffer height keeps dot size constant in CSS pixels across DPRs.
    dotMaterial.uniforms.uScale.value = renderer.domElement.height * 0.5;
    markerMaterial.uniforms.uPixelRatio.value = dpr;
    headMaterial.uniforms.uPixelRatio.value = dpr;
  };
  resize();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // --- pointer parallax --------------------------------------------------
  const pointerTarget = { x: 0, y: 0 };
  const pointerCurrent = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent) => {
    pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // --- floating labels ----------------------------------------------------
  // Anchors lifted slightly off the surface; projected to screen space every
  // frame inside the scene's own loop — DOM writes only, no React state.
  const labelAnchors = MARKERS.map((m) =>
    latLngToVector3(m.lat, m.lng, GLOBE_RADIUS * 1.01),
  );
  const labelWorld = new Vector3();
  const labelNormal = new Vector3();
  const labelToCamera = new Vector3();

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  const placeLabels = () => {
    // One layout read per frame; the hero's globe box extends past the
    // viewport, so container-local x must be mapped to viewport space to know
    // where the browser edge actually falls.
    const containerLeft = container.getBoundingClientRect().left;
    const viewportWidth = window.innerWidth;

    for (let i = 0; i < labelAnchors.length; i++) {
      const el = labels[i];
      if (!el) continue;

      labelWorld.copy(labelAnchors[i]).applyMatrix4(spin.matrixWorld);
      // Every ancestor transform is a pure rotation, so the surface normal is
      // just the world position normalised.
      labelNormal.copy(labelWorld).normalize();
      labelToCamera.copy(camera.position).sub(labelWorld).normalize();
      const facing = labelNormal.dot(labelToCamera);

      let vis = clamp01((facing - LABEL_FADE_LO) / (LABEL_FADE_HI - LABEL_FADE_LO));

      if (vis > 0.01) {
        // Edge fade: pill is centred on x (translate(-50%)), so it stays fully
        // inside the viewport while its centre is within [inset + halfWidth,
        // width - inset - halfWidth]; opacity ramps to 0 over the fade band as
        // the anchor approaches either limit. Fade, never clamp — a pill
        // floating away from its dot reads wrong.
        labelWorld.project(camera);
        const half = el.offsetWidth / 2;
        const screenX =
          containerLeft + (labelWorld.x * 0.5 + 0.5) * viewWidth;
        vis *=
          clamp01(
            (viewportWidth - LABEL_EDGE_INSET_PX - half - screenX) /
              LABEL_EDGE_FADE_PX,
          ) *
          clamp01((screenX - LABEL_EDGE_INSET_PX - half) / LABEL_EDGE_FADE_PX);
      }

      if (vis <= 0.01) {
        if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
        continue;
      }

      const x = (labelWorld.x * 0.5 + 0.5) * viewWidth;
      const y = (0.5 - labelWorld.y * 0.5) * viewHeight;

      el.style.visibility = "visible";
      el.style.opacity = vis.toFixed(3);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%) translateY(${-LABEL_LIFT_PX}px) scale(${(0.82 + 0.18 * vis).toFixed(3)})`;
    }
  };

  // --- loop ---------------------------------------------------------------
  const clock = new Clock();
  const headPoint = new Vector3();
  let elapsed = 0;
  let raf = 0;
  let painted = false;

  const frame = () => {
    raf = requestAnimationFrame(frame);

    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;

    spin.rotation.y += SPIN_SPEED * delta;

    // Exponential damping — frame-rate independent, and never overshoots.
    const damping = 1 - Math.exp(-delta * 4.5);
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * damping;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * damping;
    parallax.rotation.y = pointerCurrent.x * PARALLAX_YAW;
    parallax.rotation.x = pointerCurrent.y * PARALLAX_PITCH;

    dotMaterial.uniforms.uTime.value = elapsed;
    arcMaterial.uniforms.uTime.value = elapsed;
    markerMaterial.uniforms.uTime.value = elapsed;

    for (let i = 0; i < network.curves.length; i++) {
      const t = (elapsed * ARC_SPEED + network.headPhases[i]) % 1;
      network.curves[i].getPoint(t, headPoint);
      headPositions[i * 3] = headPoint.x;
      headPositions[i * 3 + 1] = headPoint.y;
      headPositions[i * 3 + 2] = headPoint.z;
    }
    headAttribute.needsUpdate = true;

    renderer.render(scene, camera);
    placeLabels(); // after render — world matrices are current

    if (!painted) {
      painted = true;
      onFirstFrame();
    }
  };

  const start = () => {
    if (raf) return;
    clock.getDelta(); // drop the gap accumulated while paused
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  let onScreen = true;
  // The hero is sticky, so the IO keeps reporting the canvas "visible" even
  // once the intro card has slid over it. The cover completes within ~1.4
  // viewports of scroll (130svh gradient head), so past 1.6 the scene is
  // fully occluded and rendering it is pure waste.
  let covered = false;
  const sync = () => (onScreen && !covered && !document.hidden ? start() : stop());

  let coverFrame = 0;
  const readCover = () => {
    coverFrame = 0;
    const next = window.scrollY > window.innerHeight * 1.6;
    if (next !== covered) {
      covered = next;
      sync();
    }
  };
  const onCoverScroll = () => {
    if (!coverFrame) coverFrame = requestAnimationFrame(readCover);
  };

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      sync();
    },
    { threshold: 0 },
  );
  intersectionObserver.observe(container);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("scroll", onCoverScroll, { passive: true });
  readCover();
  sync();

  return () => {
    stop();
    if (coverFrame) cancelAnimationFrame(coverFrame);
    window.removeEventListener("scroll", onCoverScroll);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pointermove", onPointerMove);

    coreGeometry.dispose();
    dotGeometry.dispose();
    arcGeometry.dispose();
    headGeometry.dispose();
    markerGeometry.dispose();
    shellGeometry.dispose();

    coreMaterial.dispose();
    dotMaterial.dispose();
    arcMaterial.dispose();
    headMaterial.dispose();
    markerMaterial.dispose();
    innerGlowMaterial.dispose();
    glowMaterial.dispose();

    renderer.dispose();
    renderer.forceContextLoss();
  };
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export default function Globe({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

    let webgl2: boolean | null = null;
    const supportsWebGL2 = () => {
      if (webgl2 === null) {
        try {
          webgl2 = !!document.createElement("canvas").getContext("webgl2");
        } catch {
          webgl2 = false;
        }
      }
      return webgl2;
    };

    const decide = () => {
      const allowed =
        !reduceMotion.matches && !small.matches && supportsWebGL2();
      setMode(allowed ? "webgl" : "static");
    };

    decide();
    reduceMotion.addEventListener("change", decide);
    small.addEventListener("change", decide);
    return () => {
      reduceMotion.removeEventListener("change", decide);
      small.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (mode !== "webgl") return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    createLandMask()
      .then((mask) => {
        if (cancelled) return;
        teardown = buildScene(container, canvas, mask, labelsRef.current, () =>
          setPainted(true),
        );
      })
      .catch(() => {
        if (!cancelled) setMode("static");
      });

    return () => {
      cancelled = true;
      teardown?.();
      teardown = null;
      setPainted(false);
    };
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={className}
      // Grid stacking instead of absolute layers: needs no positioning context,
      // so a caller is free to pass `absolute`, `relative` or neither.
      style={{ display: "grid", isolation: "isolate" }}
    >
      <div
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          minWidth: 0,
          minHeight: 0,
          background: `radial-gradient(circle at 50% 14%, ${COLOR_RIM_SUNRISE}24 0%, transparent 52%), radial-gradient(circle at 50% 88%, ${COLOR_RIM_DEEP}1c 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />

      {mode === "webgl" && (
        <canvas
          ref={canvasRef}
          style={{
            gridArea: "1 / 1",
            display: "block",
            width: "100%",
            height: "100%",
            minWidth: 0,
            minHeight: 0,
            opacity: painted ? 1 : 0,
            transition: "opacity 700ms ease",
          }}
        />
      )}

      {mode === "webgl" && (
        <div
          aria-hidden="true"
          style={{
            gridArea: "1 / 1",
            position: "relative",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
            pointerEvents: "none",
            opacity: painted ? 1 : 0,
            transition: "opacity 700ms ease",
          }}
        >
          {MARKERS.map((marker, i) => (
            <div
              key={marker.code}
              ref={(el) => {
                labelsRef.current[i] = el;
              }}
              className="absolute left-0 top-0 whitespace-nowrap rounded-full border border-white/10 bg-[#161616]/85 px-2.5 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.08em] text-white"
              style={{ willChange: "transform, opacity", visibility: "hidden" }}
            >
              {marker.name}
            </div>
          ))}
        </div>
      )}

      <StaticGlobe hidden={mode === "webgl" && painted} />
    </div>
  );
}
