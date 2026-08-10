/**
 * GLSL for the hero globe, as template strings so there is no loader step.
 *
 * Occlusion is real: an opaque near-black core sphere (radius just under the
 * dot shell) writes depth first, so every depth-tested layer — dots, arcs,
 * heads, markers — is clipped to the near hemisphere by the z-buffer and the
 * planet reads solid. `facing` (outward sphere normal · view direction; +1
 * dead centre, 0 at the limb) survives only as a *soft* limb fade on surface
 * sprites, easing the hard depth cut where oversized point sprites straddle
 * the silhouette. Arcs and heads fly above the surface and rely on depth
 * alone, so long routes can bulge outside the silhouette and still dive
 * cleanly behind the limb.
 *
 * The atmosphere is two additive shells sharing ATMOSPHERE_VERTEX, both with
 * depth fully disabled so the opaque core cannot eat them:
 *   - GLOW_FRAGMENT       BackSide, ONE limb-anchored field composing the hot
 *                         narrow rim line AND the wide soft halo tail
 *   - INNER_GLOW_FRAGMENT FrontSide, faint back-lit band inside the limb
 *
 * Fragment shaders end with `#include <colorspace_fragment>`: ShaderMaterial
 * does not apply the renderer's output colour space automatically, and our
 * uniforms arrive in linear-sRGB via three's ColorManagement.
 */

const FACING = /* glsl */ `
vec4 worldPos = modelMatrix * vec4(position, 1.0);
vec3 sphereNormal = normalize(mat3(modelMatrix) * normalize(position));
float facing = dot(sphereNormal, normalize(cameraPosition - worldPos.xyz));
`;

export const DOT_VERTEX = /* glsl */ `
attribute float aSeed;

uniform float uScale;
uniform float uDotSize;
uniform float uTime;
uniform vec3 uLightDir;
uniform float uFloor;

varying float vAlpha;

void main() {
  ${FACING}

  // Sunrise key light, fixed in world space so it stays glued to the screen's
  // upper limb while the globe spins underneath it.
  float lit = clamp(dot(sphereNormal, normalize(uLightDir)), 0.0, 1.0);
  float light = pow(lit, 0.75);

  // Shimmer amplitude is kept small so the night-side floor genuinely holds.
  float shimmer = 0.93 + 0.07 * sin(uTime * 0.9 + aSeed * 6.2831853);
  // The opaque core hides the far hemisphere via depth; this narrow ramp only
  // softens the last few degrees at the limb so dots don't pop off hard.
  float horizon = smoothstep(-0.02, 0.12, facing);
  // Alpha carries the whole day/night ramp — uFloor keeps the dark face at a
  // clearly visible level instead of letting it vanish. Colour stays white.
  vAlpha = horizon * mix(uFloor, 1.0, light) * shimmer;

  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = max(uDotSize * uScale / -mvPosition.z, 1.0);
}
`;

export const DOT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;

varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float disc = 1.0 - smoothstep(0.32, 0.5, d);
  if (disc < 0.01) discard;

  // Pure white at every sun angle — the vertex alpha alone dims the night
  // side, so the field reads as bright separated points, never a grey mesh.
  gl_FragColor = vec4(uColor, disc * vAlpha);
  #include <colorspace_fragment>
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vViewNormal;
varying vec3 vViewPosition;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * Combined atmosphere glow — a SINGLE BackSide shell well outside the planet
 * whose radial profile composes the tight rim line and the wide halo bloom,
 * so there is no seam between them by construction.
 *
 * A plain fresnel would peak at THIS shell's silhouette and read as a
 * detached ring floating off the planet (exactly the "multi layers" bug), so
 * everything is anchored to the *planet's* limb instead: `s` is the sine of
 * the fragment's polar angle from the view axis (0 disc centre, 1 at the
 * shell's own edge) and `uLimb` marks where the planet's tangent ray crosses
 * this shell's back face (perspective-exact, supplied per resize).
 *
 * Radial profile in t = (s - uLimb) / (1 - uLimb), i.e. 0 at the planet limb
 * and 1 at the shell's geometric edge:
 *   peak  — hot narrow line, exp decay with uRimFalloff
 *   tail  — wide soft bloom, exp decay with uHaloFalloff
 * Both are *shifted* exponentials, (exp(-t·k) − exp(−k)) / (1 − exp(−k)), so
 * each lands on EXACTLY zero at t = 1 for every polar angle — the shell's own
 * silhouette can never print.
 *
 * Sunrise grade: view-space `n.y` is height on the limb. The peak sweeps deep
 * blue (lower limb) through warm orange (upper sides) into near-white at the
 * very crown; the tail runs orange over the top into a big saturated blue
 * wrap below. The two contributions are summed exactly as two additive passes
 * would be: alpha = peakA + tailA, colour = the alpha-weighted mix.
 */
export const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uRimTop;
uniform vec3 uRimBottom;
uniform vec3 uRimCrest;
uniform vec3 uHaloTop;
uniform vec3 uHaloBottom;
uniform float uLimb;
uniform float uRimFalloff;
uniform float uHaloFalloff;
uniform float uRimIntensity;
uniform float uHaloIntensity;

varying vec3 vViewNormal;
varying vec3 vViewPosition;

void main() {
  vec3 n = normalize(vViewNormal);
  float d = abs(dot(n, normalize(-vViewPosition)));
  float s = sqrt(max(1.0 - d * d, 0.0));

  // 0 at the planet limb -> 1 at the shell's geometric edge.
  float t = clamp((s - uLimb) / (1.0 - uLimb), 0.0, 1.0);

  // Shifted exponentials: identically zero at t = 1 (the shell edge).
  float peak =
    (exp(-t * uRimFalloff) - exp(-uRimFalloff)) / (1.0 - exp(-uRimFalloff));
  float tail =
    (exp(-t * uHaloFalloff) - exp(-uHaloFalloff)) / (1.0 - exp(-uHaloFalloff));

  // Fade out just inside the limb — INNER_GLOW owns the planet's face.
  float inside = smoothstep(uLimb - 0.04, uLimb, s);

  float up = n.y;

  // TWO LOBES, not one ring. The reference's atmosphere lives almost entirely
  // on the crown (warm) with a softer blue wrap under the belly; at the
  // mid-limb (up ~ 0) it is nearly dark. A single bottom->top colour mix also
  // walks through magenta where orange meets blue — two disjoint lobes with
  // a dead zone between them can't.
  float lobeTop = smoothstep(0.06, 0.78, up);
  float lobeBot = smoothstep(0.22, 0.88, -up);
  float crest = smoothstep(0.60, 0.97, up);

  // Warm lobe: orange line igniting to near-white only at the very crown.
  vec3 warm = mix(uRimTop, uRimCrest, crest);
  float warmA =
    (peak * uRimIntensity * mix(1.0, 2.1, crest) + tail * uHaloIntensity) *
    lobeTop;

  // Cool lobe: dimmer, tail-dominant — a soft blue wash, not a second ring.
  vec3 cool = uHaloBottom;
  float coolA =
    (peak * uRimIntensity * 0.38 + tail * uHaloIntensity * 0.55) * lobeBot;

  float alpha = (warmA + coolA) * inside;
  vec3 color = (warm * warmA + cool * coolA) / max(warmA + coolA, 1e-5);

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

/**
 * Interior edge light — FrontSide shell at the dot sphere's radius. The same
 * fresnel term peaks at the limb on the near face and dies toward disc
 * centre: a faint back-lit band just INSIDE the silhouette, orange up top and
 * blue below, so the unlit face doesn't read as a flat black cutout.
 */
export const INNER_GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColorTop;
uniform vec3 uColorBottom;
uniform float uPower;
uniform float uIntensity;

varying vec3 vViewNormal;
varying vec3 vViewPosition;

void main() {
  vec3 n = normalize(vViewNormal);
  float edge = pow(1.0 - abs(dot(n, normalize(-vViewPosition))), uPower);

  float up = n.y;
  // Same two-lobe shape as the outer glow: warm crown, soft blue belly,
  // near-dark mid-limb — an all-round inner ring would re-print the halo
  // ring the outer shell just stopped drawing.
  float lobeTop = smoothstep(0.05, 0.80, up);
  float lobeBot = smoothstep(0.25, 0.90, -up);
  float warmA = 1.25 * lobeTop;
  float coolA = 0.55 * lobeBot;
  vec3 color =
    (uColorTop * warmA + uColorBottom * coolA) / max(warmA + coolA, 1e-5);

  gl_FragColor = vec4(color, edge * uIntensity * (warmA + coolA));
  #include <colorspace_fragment>
}
`;

export const ARC_VERTEX = /* glsl */ `
attribute float aProgress;
attribute float aPhase;

varying float vProgress;
varying float vPhase;

void main() {
  vProgress = aProgress;
  vPhase = aPhase;

  // No facing fade: arcs float well above the surface, so a facing-based cut
  // would wrongly erase high segments bulging outside the silhouette. The
  // depth test against the opaque core hides them behind the limb instead.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Travelling comet along each lane: `head` sweeps 0..1, and every vertex
 * measures how far *behind* the head it sits (wrapped), then decays
 * exponentially. A dim base line keeps the whole network legible at rest.
 */
export const ARC_FRAGMENT = /* glsl */ `
uniform vec3 uLineColor;
uniform vec3 uHeadColor;
uniform float uTime;
uniform float uSpeed;
uniform float uTrail;
uniform float uBase;

varying float vProgress;
varying float vPhase;

void main() {
  float head = fract(uTime * uSpeed + vPhase);
  float behind = fract(head - vProgress);
  float comet = exp(-behind / uTrail);

  float alpha = uBase + comet * 0.9;
  if (alpha < 0.004) discard;

  gl_FragColor = vec4(mix(uLineColor, uHeadColor, comet), alpha);
  #include <colorspace_fragment>
}
`;

export const MARKER_VERTEX = /* glsl */ `
attribute float aPhase;

uniform float uSize;
uniform float uPixelRatio;

varying float vPhase;
varying float vFacing;

void main() {
  ${FACING}
  vFacing = facing;
  vPhase = aPhase;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
  gl_PointSize = uSize * uPixelRatio;
}
`;

/** Solid core plus an expanding ring that fades as it grows — a sonar ping. */
export const MARKER_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uSpeed;

varying float vPhase;
varying float vFacing;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.12, 0.22, d);

  float p = fract(uTime * uSpeed + vPhase);
  float ringRadius = mix(0.16, 0.94, p);
  // Reversed smoothstep edges are undefined in GLSL — invert instead.
  float ring = (1.0 - smoothstep(0.0, 0.11, abs(d - ringRadius))) * (1.0 - p);

  // Depth against the opaque core does the real occlusion; this narrow ramp
  // just eases oversized point sprites straddling the limb.
  float horizon = smoothstep(-0.02, 0.12, vFacing);
  float alpha = (core + ring * 0.7) * horizon;
  if (alpha < 0.004) discard;

  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;

/**
 * Soft round sprite for the head riding the front of each comet. Like the
 * arcs it carries no facing fade — the head rides above the surface and the
 * depth test swallows it behind the limb.
 */
export const HEAD_VERTEX = /* glsl */ `
uniform float uSize;
uniform float uPixelRatio;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * uPixelRatio;
}
`;

export const HEAD_FRAGMENT = /* glsl */ `
uniform vec3 uColor;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float glow = pow(1.0 - clamp(d, 0.0, 1.0), 2.4);
  float alpha = glow;
  if (alpha < 0.004) discard;

  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;
