# Veyra — Freight, unified.

A premium freight/logistics marketing site for a fictional APAC carrier network.

Hero headline: **EVERY MILE / ACCOUNTED / FOR**

## What this project is

This is a **technique recreation**, not a clone. We studied how
[unitedcarriers.com](https://unitedcarriers.com) is engineered and rebuilt the same
*mechanisms* — layered 2D vehicle rigs with distance-locked wheels, scroll-scrubbed image
sequences, WebGL scenes, smooth scroll, hand-rolled text splitting — behind our own brand,
copy, palette and layout. None of the reference site's design, assets, or content is
reproduced here.

## Running it

```bash
npm run dev      # http://localhost:3000
npm run build    # production build — this is the CI gate
npm run lint     # eslint
npx tsc --noEmit # type check
```

Everything is already installed. **Do not run `npm install`** — the lockfile is pinned to
Next 15 deliberately (see "Ground rules").

Current status: `tsc --noEmit` and `eslint .` pass clean. `next build` has not been re-run
since the yard rig landed — a dev server currently owns `.next`, and a production build
against a live dev server corrupts its state. Typecheck is the gate until that server is
stopped. The page prerenders statically; first-load JS is ~169 kB because three.js is
code-split out of the initial bundle (see "Page composition").

## Page composition

`app/page.tsx` is the whole site — one route, eight sections, in this order:

| Order | Section | Treatment |
| --- | --- | --- |
| — | `Nav` | fixed; transparent over the hero with a slim news-ticker utility bar and a desktop vertical menu column (~40% x); past the hero the column and utility bar collapse and the bar goes solid night with a bottom border |
| 1 | `Hero` (`#top`) | near-black `#050505`, starfield, ~95vh dot-matrix WebGL globe on the right (sunrise-orange upper rim / deep-blue lower rim, ~100s revolution, 18 projected country pill labels, orange arcs), headline at ~29% left overlapping the globe's limb, line-by-line reveal, hero-scoped cursor ring |
| 2 | `IntroSection` (`#about`) | white, word-by-word colour brighten on scrub |
| 3 | `YardSection` | white, **pinned 1100% layered photoreal yard narrative** — reach stacker picks a container off the stack, an *empty* truck reverses in, the box is placed on its bare trailer, the loaded truck departs, side → overhead |
| 4 | `ServicesSection` (`#services`) | night, scramble-in headings |
| 5 | `WhySection` (`#why`) | ocean blue, WebGL ocean + wake simulation |
| 6 | `TestimonialsSection` (`#testimonials`) | off-white cards |
| 7 | `PartnersSection` (`#partners`) | infinite marquee |
| 8 | `FaqSection` (`#faq`) | white accordion |
| — | `Footer` (`#contact`) | night, animated SVG route line |

Everything is wrapped in `<SmoothScroll>`, which owns the Lenis instance and drives it from
the GSAP ticker so both share one rAF loop.

### Two things that matter for scroll correctness

**ScrollTrigger refresh timing.** Webfonts change headline metrics, which moves the start/end
of every pinned section — mis-measured pins are the number one bug in this kind of build.
`SmoothScroll` owns the single authoritative `ScrollTrigger.refresh()` after
`document.fonts.ready`. Individual sections must not call `refresh()` themselves.

**Pin ordering.** `YardSection` is now the **only** pin on the page. It uses
`trigger: <section>`, `start: "top top"`, `end: "+=1100%"` and pins its own `<div>` stage, so
ScrollTrigger inserts exactly one `.pin-spacer` inside the section. Measured in-browser at a
1440×900 viewport:

| Section | Section top | Pin range | Section height |
| --- | --- | --- | --- |
| `YardSection` | 2714 | 2714 → 12614 | 10800 (`100svh` + `1100%`) |

`ServicesSection` starts at 12614 + 900 = 13514, i.e. exactly where the pin-spacer ends —
no overlap, no gap. The whole document is 18461 px, one `.pin-spacer` element, zero
`position: sticky` elements. Every other section's ScrollTrigger is unpinned and created
after that spacer exists, including the `Ocean` scene's, so nothing downstream can be
mis-measured. At ≤768px or under `prefers-reduced-motion` the section creates **no**
ScrollTrigger at all and collapses to exactly one viewport (verified: zero `.pin-spacer`
elements at 466×441).

The previous build split this narrative across two pinned sections and that split was the
bug — the crane beat and the truck beat read as two disconnected stories. One section, one
progress value, one timeline is the fix, and it is also what the reference site does: its
`.home-service` is a single 12,481 px (12.7 viewport) pinned block.

If you add a second pinned section, put it in DOM order and do not give it a
`refreshPriority` unless it is created out of order — the current ordering works because
creation order already matches document order.

**WebGL is lazy.** `Globe` and `Ocean` are loaded with `next/dynamic({ ssr: false })` from
inside `Hero` and `WhySection`. three.js never runs during SSR and never enters the initial
bundle. Both scenes also refuse to initialise at ≤768px or under `prefers-reduced-motion`,
falling back to a static poster.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), TypeScript, no `src/` dir, `@/*` alias |
| Styling | Tailwind v4 (CSS-first `@theme`, no `tailwind.config.js`) |
| Animation | GSAP 3 (free) + ScrollTrigger |
| Smooth scroll | Lenis |
| 3D | three.js (WebGL2) |
| Fonts | `next/font/google` — Archivo (display), Inter (body), Space Mono (accents) |

No paid packages. **No GSAP Club plugins** — SplitText and ScrambleText are behind the paid
Club membership, so we hand-roll both in `lib/scramble.ts`.

Node v22.22.2 / npm 10.9.7. `ffmpeg` is available for frame extraction and for decoding
masters to raw RGBA when re-measuring, but the local Homebrew build has **no libwebp** — use
`cwebp` for WebP encoding. Blender is **not** installed, so no 3D asset authoring; the crane
and truck are layered photoreal stills, which is exactly why that does not block anything.

## Teardown of the reference site

These are verified facts gathered through DevTools, recorded here so every contributor is
working from the same picture.

**Base architecture.** Webflow-generated markup with a separate Vite/Rolldown JavaScript
bundle hosted on Netlify. The visual polish is entirely in that bundle, not in Webflow.

**Libraries in the bundle.** GSAP + ScrollTrigger, Lenis (smooth scroll), Barba.js (page
transitions), Swiper (carousels), three.js (WebGL2).

**Bundle chunks observed.** `vendor-gsap`, `vendor-three`, `vendor-barba`, `lenis`, `scroll`,
`layout`, `navigation`, `frame-sequence`, `globe`, `OceanScene`, `WakeSimulation`,
`my-flights`, `swiper`, `popup`.

### The key finding: the "3D" crane and truck are not 3D

The crane and truck animations look like real-time 3D. They are not. They are **170
pre-rendered AVIF stills** named `frame_000.avif` … `frame_169.avif`, drawn into a plain 2D
`<canvas>` and scrubbed by scroll position. The heavy rendering happened once, offline; the
browser just blits one image per frame.

This is why not having Blender doesn't block us — the runtime technique is images, and any
source of ordered stills will do.

**And the truck is cheaper still.** Confirmed in DevTools, the truck is not even a sequence
most of the time — it is stacked 2D layers with individually rotated wheels:

```
.home-service-truck-inner
  .home-service-truck-full   -> img truck-static.avif     opacity 0
  .home-service-truck-car    -> img only-car.avif         opacity 1, z-2
  .home-service-truck-cont   -> img only-container.avif   opacity 0, z-1
  .home-service-truck-wheel                               z-3
      .wheel-1 .. .wheel-5    five separate 41x41 divs, each the wheel image
  canvas.home-service-truck-sq  opacity 0, z-3            sequence, crossfades IN only
                                                          when a real camera move is needed
```

Their `.home-service` section is 12,481 px tall — 12.7 viewports of pinned scroll, carrying
the entire yard narrative on **one** scrubbed timeline. This layered approach, not the
flipbook, and that single-section structure are what `YardSection` recreates.

Canvas contexts, confirmed one by one:

| Canvas id | Context | Notes |
| --- | --- | --- |
| `home-hero-canvas` | `webgl2` | the globe |
| `home-service-crane-sq` | `2d` | image sequence, 1566×880 |
| `home-service-truck-sq` | `2d` | image sequence |
| `home-service-mb-crane-sq` | `2d` | mobile variant |
| `home-why-ocean-img` | `webgl2` | ocean scene |
| `footer-logo-canvas-inner` | `2d` | |

The `-sq` suffix in their naming means *sequence*. Only the two `webgl2` canvases are real
3D; everything else is a scrubbed flipbook.

**Ocean scene assets.** `water-normal.webp`, `ocean-envmap.webp`, `ocean-overlay.webp`, plus a
looping `Sea-wave` mp4/webm. `WakeSimulation` is a separate chunk handling ship-wake ripples.

**Section classes.** `home-hero`, `home-intro`, `home-service`, `home-service-mb`, `home-why`,
`home-testi`, `home-partners`, `home-ins`, `home-faq`.

**Type.** Display face is "BT Steinhart" (a paid font) with "Helvetica Neue" for body and a
mono cut for accents. We substitute free equivalents: **Archivo** (weights 600–800, similar
expanded feel) for display and **Inter** for body, both via `next/font/google`, with **Space
Mono** for mono accents.

## Design tokens

Defined in `app/globals.css` inside Tailwind v4's `@theme` block, so they are available both
as utilities (`bg-night`, `text-signal`) and as raw CSS variables (`var(--color-night)`).

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#FFFFFF` | page background |
| `--color-ink` | `#111111` | body text |
| `--color-night` | `#0A0A0B` | full-bleed near-black sections |
| `--color-ocean` | `#0B4FA8` | ocean section gradient start |
| `--color-abyss` | `#062E63` | ocean section gradient end |
| `--color-signal` | `#FF4D2E` | accent |
| `--color-mist` | `#E8E8E6` | hairlines, muted fills |

Font tokens `--font-display`, `--font-body` and `--font-mono` map onto the `next/font`
variables `--font-archivo`, `--font-inter` and `--font-space-mono`, which are set on `<body>`
in `app/layout.tsx`. Use the Tailwind utilities `font-display`, `font-body`, `font-mono`.

`.u-display` is the shared headline class — display font, uppercase, bold, tight leading, and
a `clamp()` fluid size. It needs no responsive variants; the `clamp()` handles every
viewport. Every big headline should use it.

## Shared interface contracts

Code against these signatures; they are fixed.

```ts
// lib/gsap.ts
export { gsap, ScrollTrigger };   // ScrollTrigger already registered, client-only safe

// components/FrameSequence.tsx  (default export)
// Working infrastructure, currently unused by any section — it is here for the day
// real rendered sequences arrive. See "Frame sequences" below.
function FrameSequence(props: {
  basePath: string;   // "/frames/yard" -> `${basePath}/frame_000.${ext}`
  count: number;      // 170
  ext?: string;       // default "webp"
  pad?: number;       // default 3
  width: number;
  height: number;
  start?: string;     // ScrollTrigger start, default "top top"
  end?: string;       // ScrollTrigger end, default "+=200%"
  pin?: boolean;      // default true
  className?: string;
  children?: React.ReactNode;  // overlay rendered above the canvas
}): JSX.Element;

// hooks/useWheelRotation.ts — rolls elements in proportion to distance travelled.
// Runs on gsap.ticker, owns no ScrollTrigger, inert under prefers-reduced-motion.
function useWheelRotation(
  refs: RefObject<HTMLElement | null>[],
  opts: {
    wheelDiameterPx: number | (() => number);  // getter is called EVERY frame — cache it
    getDistancePx: () => number;               // same value that moves the body
    direction?: 1 | -1;                        // default 1
  },
): void;

// hooks/useLayerCrossfade.ts — opacity for a stack of layers off one progress value.
// Window boundaries are COMPLETION points: up over [in - fade, in], down over
// [out - fade, out]. Sets `visibility: hidden` at opacity 0; do not set your own
// inline visibility on a layer. Keeps running under reduced motion (it is layer
// logic, not decoration). Match each layer's CSS initial opacity to its value at p=0.
function useLayerCrossfade(
  layers: { ref: RefObject<HTMLElement | null>; in: number; out?: number; fade?: number }[],
  getProgress: () => number,
): void;

// hooks/useOdometer.ts — smoothed integer readout, writes textContent only on change.
function useOdometer(
  ref: RefObject<HTMLElement | null>,
  getValue: () => number,
  opts?: { pad?: number; suffix?: string; smooth?: number },  // smooth default 0.18
): void;

// components/scenes/Globe.tsx   (default export)
function Globe(props: { className?: string }): JSX.Element;

// components/scenes/Ocean.tsx   (default export)
function Ocean(props: { className?: string }): JSX.Element;

// lib/scramble.ts
function scrambleText(el: HTMLElement, opts?: { duration?: number; chars?: string }): void;
function splitChars(el: HTMLElement): HTMLSpanElement[];   // hand-rolled SplitText
function splitLines(el: HTMLElement): HTMLSpanElement[];
```

## Layout

```
app/            layout.tsx, page.tsx, globals.css
components/     shared components (FrameSequence, nav, etc.)
components/sections/   one file per page section
components/yard/       the whole yard rig: geometry.ts + road.ts (all the maths),
                       ContainerBox, ContainerStack, ReachStacker, TruckRig,
                       TruckTopRig, RoadPath, SpeedReadout (all dumb sprites)
components/scenes/     WebGL scenes (Globe, Ocean)
lib/            gsap.ts, scramble.ts, assetGeometry.ts, other non-React helpers
hooks/          useWheelRotation, useLayerCrossfade, useOdometer, useFrameSequence
public/assets/         the seven photoreal masters + manifest.json (see ASSETS.md)
public/frames/         empty — real rendered sequences would land here
public/textures/       WebGL textures
scripts/        asset tooling (optimise-assets.sh, sync-geometry.mjs, ffmpeg helpers)
```

### The yard rig

`YardSection` is a **layered 2D photoreal composition**, not a frame sequence and not runtime
3D. This is the same technique the reference site uses for its truck: cheap stacked images,
individually transformed, with the expensive motion sold through parallax, a camera change
and correct wheel physics.

Every sprite lives inside one **world box** with a fixed `2688 / 1536` aspect ratio, so every
measured manifest fraction is used verbatim as a CSS percentage and the whole composition
survives a resize without a single `getBoundingClientRect()`. One `requestAnimationFrame`
callback on `gsap.ticker` writes every transform; nothing tweens independently.

#### The constraint model — why the spreader actually touches the box

The old build animated the container on its own track and hoped it lined up with the
spreader. It did not, and that visible gap was the headline complaint. The container is now
**parented**, the way it would be in 3D. Its pose is never authored; it is read off whichever
parent currently owns it, evaluated at the *same* `p` in the *same* frame:

```
containerPose(p) =
    p <= PICK    ->  PICK_SLOT                             // resting on the stack
    PICK..DROP   ->  gripPose(p)   - (BOX_W/2, 0)          // rigidly held by the spreader
    p >  DROP    ->  deckPose(p)   - (BOX_W/2, BOX_H)      // riding the trailer deck
```

`gripPose(p)` is itself derived from `cranePose(p)`, and `deckPose(p)` from `truckXAt(p)`, so
the gap is arithmetically zero at every scroll position — including a reverse scrub, because
there is no state, only a pure function of `p`. Across `DROP..DROP_END` the held pose blends
into the deck pose through `dropEase()` (accelerating fall, one heavily damped settle), so
the release reads as a deliberate hand-off rather than a cut.

Two details that are load-bearing:

- **Anchor to `GRIP`, not `spreaderTip`.** `manifest.json`'s `reachStacker.spreaderTip`
  `{x: 0.745, y: 0.348}` is the hazard beam's front *face*, 1.73% of the canvas right of the
  surface a container actually touches. `components/yard/geometry.ts` uses
  `GRIP = {x: 0.728051, y: 0.347897}` and `GRIP_SPAN = {x0: 0.639137, x1: 0.816964}`.
  Anchoring to `spreaderTip.x` hangs the box off the side of the machine.
- **Size the machine, solve its lane — not the other way round.** The reach stacker is a
  single still image, so its boom cannot telescope or luff, and stretching, skewing or scaling
  the boom to fake extension looks broken. Something in the chain still has to be solved so
  the spreader's fixed contact plane lands exactly on the top face of a container standing on
  the stack ground. Solving the *width* is the obvious move and it is wrong: this asset's
  spreader head spans only a third of a 40ft box, so the machine comes out narrower than its
  own load and the container covers the boom and the cab — mathematically touching, visually
  impaled. `STACKER_W = 0.92` is therefore authored, and the ground line falls out of it:

  ```ts
  GROUND.crane = GROUND.stack - BOX_H + (STACKER_GROUND - GRIP.y) * STACKER_H;
  ```

  The identity is exactly as tight (the measured gap is 0.000 px, see below) and the machine
  now reads at 2.56× the loaded truck's body height, close to the real ~2.5×. The lane lands
  at 1.016 — *downstage of the truck's 0.855* — so `ReachStacker` renders **after** `TruckRig`
  and the machine works the near side of the truck lane. If you re-scale it, keep that order
  in step with the sign of `GROUND.crane - GROUND.truck`.

The pick is sold by moving the crane *body* until the spreader arrives at the box, and the
lift by `CRANE_LIFT = 0.026` world height of body rise (tyre-recoil scale, ~19 px at a 1280
viewport) plus a ground shadow that stays welded to the crane lane and widens as it fades.
`CRANE_RISE` is keyed to zero at both `BEAT.pick` and `BEAT.drop`, so both contact identities
hold exactly.

Verified twice — analytically against the module itself, and in-browser at a 1440×900 viewport
(world 1404×802) by measuring live DOM rects:

| p | box top vs. spreader hairline | box centre vs. grip centre |
| --- | --- | --- |
| 0.175 (lock) | 1.00 px | 0.008 px |
| 0.20 → 0.45 (carry) | 1.00 px | ≤ 0.09 px |
| 0.30, 0.175 (reverse scrub) | 1.00 px | ≤ 0.09 px |

The 1.00 px is the hairline's own geometry — it is a 2 px rule with `margin-top: -1px`, so its
centre sits exactly on the contact plane; the sub-0.1 px x offset is the `toFixed(1)` rounding
on the two `translate3d` strings. Analytically the gap is 0 to floating-point exactness at
every sampled p, in both directions. Post-release the box lands 0.021 px off the deck plane
and 0.004 px off the load-span centre, and tracks the departing truck to within 0.2 px over a
155 px move.

#### The narrative

One pinned section, one progress value, one timeline. The beats:

| p | Beat |
| --- | --- |
| 0.00 – 0.17 | Yard. Three containers right of frame; the reach stacker drives in from off stage left and eases onto the pick box |
| ~0.17 | **Lock.** Grip x settles on `PICK_X`, the signal hairline pulses across the measured grip span, the box shadow snaps tight |
| 0.17 – 0.27 | Lift. The box is parented to the spreader; the machine reverses out with it |
| 0.24 – 0.40 | **The truck arrives empty.** `truck-empty-cut.webp` reverses in from `TRUCK_ENTER = 1.3` — genuinely off stage at every viewport — and parks; speed falls to `00 KM/H` |
| 0.375 – 0.50 | **Swing.** The crane starts back toward deck centre *while the truck is still settling*, body rise returning to 0 |
| 0.50 – 0.535 | **Place.** The box is released for a `SETTLE = 0.04` free fall onto the bare trailer, with one damped settle |
| 0.535 – 0.70 | Clear. The crane reverses off stage left at a steady rate, leaving daylight above the loaded box |
| 0.62 – 0.70 | Copy band fades up under the exit |
| 0.66 – 0.80 | Depart, then the camera change — side layer scales and blurs past the lens, overhead layer eases in from a wider framing |
| ~0.74 | Copy hand-off: `01 — TERMINAL` → `02 — LAND` |
| 0.75 – 0.94 | Overhead run on a hand-drawn SVG road |
| 0.94 – 1.00 | Exit — "Next leg: Sea." |

**Beats overlap on purpose.** Two beats that merely abut leave a frame where the outgoing move
has finished and the incoming one has not started, and scrubbed, that frame is dead air — the
same "happening in different sections" complaint that splitting the yard into two pinned
sections produced, only smaller. Sampling every animated pose at 1000 points, the only p where
nothing on stage moves are the two deliberate contact beats (the lock at ~0.17 and the moment
of release at ~0.50), together about 1% of the scroll. Anything wider than that is a bug: the
symptom is an eased-out keyframe butted against an eased-in one, and the fix is either to
overlap the two moves or to run them as a single leg (`GRIP_X`'s retreat is one linear leg for
exactly this reason).

**The deck line.** `truck-empty`'s `deck.y = 0.547266`, `deck.x0 = 0.09375`,
`deck.x1 = 0.590774` (source fractions of its own 2720×1536 canvas). `deck.x0..x1` is the
*load span* — where a container actually sits on this trailer — not the wider span of visible
rail, and it is derived from the loaded reference master so the two agree. In world space:

```ts
DECK_Y  = TRUCK_TOP_Y + TRUCK_EMPTY.deck.y * TRUCK_H;   // plane the box bottom rests on
DECK_CX = (deck.x0 + deck.x1) / 2;                       // load-span centre
BOX_W   = 0.92 * (deck.x1 - deck.x0) * TRUCK_W;          // container fills 92% of the span
```

Everything else hangs off `DECK_Y`: `GROUND.stack = DECK_Y - SETTLE` (so the free fall onto
the deck is exactly `SETTLE`), and `GROUND.crane` is solved from `STACKER_W` as above. Four
ground planes — column 0.674, stack 0.719, truck 0.855, crane 1.016 — give the depth stagger,
and the crane's is the lowest, which is why it draws over the truck.

**The wheel formula.** A wheel must rotate in proportion to distance travelled, never at a
fixed rate, or it reads as skidding on ice:

```ts
const circumference = Math.PI * wheelDiameterPx;
const rotationDeg   = (distanceTravelledPx / circumference) * 360;
```

`distanceTravelledPx` must come from the *same* scroll-derived value that moves the vehicle.
In `YardSection` that value is `rolledUnits(p)`, which **is** `truckXAt(p)` — signed, and
nothing else added to it — so reversing into the bay counter-rotates the wheels and a
backwards scrub unwinds them. It used to fold in the overhead leg's `pathDistance(p)` as well;
that is a second, independent value which does not move this truck, and it spun these overlays
during a beat where the side layer is already faded out. Measured: −7.22 revolutions over the
reverse-in, +10.96 over the departure, at a 1280 viewport.

Note `useWheelRotation` takes **one** diameter for all five refs. The five measured radii fall
away with perspective in the render (0.0322 → 0.0292 of canvas width, real perspective, not
noise), so `WHEEL_DIAMETER_FRAC` passes the mean and each wheel is within ~3% of its own true
rolling rate. Per-wheel *placement* and *scale* still use the individual radius, so nothing is
misregistered — only the rolling rate is shared.

### Frame sequences

`components/FrameSequence.tsx` and `hooks/useFrameSequence.ts` are kept and working, but **no
section imports them right now** — the placeholder frames they used to drive were deleted once
the photoreal rigs landed. They are the drop-in path for the day a real rendered sequence
exists (for example, a genuine camera move that layered 2D cannot fake). Drop
`frame_000.webp … frame_169.webp` into `public/frames/<name>/` and mount `<FrameSequence>`.

We use **WebP**, not AVIF, for frames — it decodes faster in a per-frame draw loop and is
universally supported. `FrameSequence` takes an `ext` prop if that ever changes.

## What is real and what is placeholder

Be honest with yourself about this before showing it to anyone.

### Real (shipping quality)

- All motion, scroll and rendering code: both vehicle rigs, the frame-sequence scrubber, both
  WebGL scenes, smooth scroll, the hand-rolled `splitChars` / `splitLines` / `scrambleText`.
- **The yard artwork.** Seven photoreal masters in `public/assets/`, measured
  programmatically (not by eye) into `manifest.json`, encoded to WebP at 920.9 KB for the
  whole set. The "NOT FINAL ART" placeholder frames are gone.
- Layout, type scale, colour system, responsive behaviour, reduced-motion and mobile
  fallbacks, focus management, ARIA wiring.
- The ocean scene is genuinely asset-free — all noise, caustics, god rays and the wake
  solver are hand-written GLSL, no textures and no video.

### Placeholder (must be replaced before launch)

| Thing | Where | Status |
| --- | --- | --- |
| Globe land mask | `lib/globe/landmask.ts` | coarse built-in coastline data, not a real earth mask |
| `container-cut.webp` alpha | `public/assets/` | broken keying — see ASSETS.md. The rig works around it by cropping `container.webp` instead |
| Copy, names, numbers | every section | invented — partner names, testimonials, the Singapore UEN in the footer, all statistics |

### Swapping in higher-quality assets later

The rigs are driven entirely by `public/assets/manifest.json`, so better artwork is a
**data** change, not a code change. Full procedure in `ASSETS.md`; the short version:

1. Drop the new master PNGs into `public/assets/` under the **same seven names**, keeping the
   same canvas aspect (2688×1536 for the vehicles, square for the wheel). Keep both the plain
   and the `-cut` (alpha) variant.
2. Re-encode: `./scripts/optimise-assets.sh` (uses `cwebp`; the local ffmpeg has no libwebp).
3. Re-measure into `public/assets/manifest.json` — content boxes, the five wheel centres and
   radii, the wheel hub centre, the spreader tip. ASSETS.md documents the method used
   (threshold-swept content boxes, gradient Hough for the wheels, ground-line radii).
4. `node scripts/sync-geometry.mjs` to regenerate `lib/assetGeometry.ts` from the manifest.
   **This step is required** — the app imports the generated TS module, not the JSON, so a
   manifest edit alone changes nothing.
5. `npx tsc --noEmit`, then scrub `YardSection` in a browser — check the lock at p≈0.18 and
   the placement at p≈0.50 in particular, since both are stated as equalities in
   `components/yard/geometry.ts` and a bad measurement breaks them silently.

If instead you get a real pre-rendered *sequence* (a camera move layered 2D cannot fake),
extract it and mount `<FrameSequence>` — see "Frame sequences" above:

```bash
./scripts/video-to-frames.sh yard.mp4 public/frames/yard 170
./scripts/optimise-frames.sh public/frames/yard --webp -q 78
```

## Honest assessment: code vs assets

The reference site's quality comes from two separable things, and we have one of them.

**The engineering is here.** Scroll-scrubbed image sequences with coarse-to-fine preloading
and nearest-neighbour fallback, a WebGL2 globe with great-circle arc lanes, a WebGL2 ocean
with a ping-pong half-float wake solver, Lenis-driven smooth scroll correctly married to
ScrollTrigger, a 12-viewport pin that does not fight anything downstream, a constraint-solved
vehicle rig, hand-rolled text splitting. Mechanically this matches what the reference bundle
does.

**The art direction is now here too, for the yard section.** It runs on real photoreal
masters rather than procedural placeholders, and the rig around them is built on measured
geometry and solved identities rather than eyeballed offsets. The remaining art gap is the
globe, which would gain more from one real equirectangular land mask
(`public/textures/README.md` documents the one-line swap) than from any further shader work.

Put plainly: the runtime is finished and the hero section is dressed. Anyone judging this
build should judge the code, then look at `ASSETS.md` for what is left.

## Ground rules

1. **Dependencies are frozen.** Everything needed is already installed. Do not run
   `npm install`. If something seems missing, solve it with what is there.
2. **Never start or restart a dev server** as part of automated work, and do not run
   `npm run build` while one is running — it corrupts the running server's `.next`. Verify
   with `npx tsc --noEmit` and `npx eslint`.
3. All GSAP / Lenis / WebGL code is client-only: `"use client"` at the top, and every
   `window` / `document` access guarded inside `useEffect`.
4. Respect `prefers-reduced-motion`, and give every scene a mobile fallback — viewports
   ≤768px must not run WebGL. Show a static poster instead.
5. TypeScript must compile clean. Avoid `any` unless genuinely unavoidable.

## Known gaps

- `YardSection` has been probed in a real browser at 1440×900: the pin range, the
  spreader-to-container contact identity (forwards *and* on a reverse scrub), the release onto
  the deck, the lock pulse, the truck's arrival and departure and the camera change are all
  confirmed there by DOM measurement, and the pick / arrival / place / loaded beats have been
  looked at as rendered frames. The **mobile and reduced-motion static pose has only been
  derived**, not rendered: `STATIC_P = 0.66` with `w-[min(108vw,110svh)] top-[54%]` is sized
  so the whole loaded rig including the cab nose fits a 375 px viewport and clears the stacked
  copy, but nobody has seen it. Tablet widths and the WebGL scenes still need a manual QA
  pass, and nothing has been checked on a real phone — an emulated viewport does not resolve
  `svh` the way a device does.
- `npm run build` has **not** been run since the rig landed (a live dev server owns `.next`).
  `tsc --noEmit` and `eslint` are clean; the production build is unverified.
- The truck **reverses** into the bay (enters from the right moving left, cab facing right)
  and then pulls away right. That is the only reading consistent with a right-facing cab and
  a "pulls away right" exit. Wheel direction is honest either way — rotation is signed off the
  truck's own x. To make it drive in forwards instead, flip the first keys of `TRUCK_X` in
  `components/yard/geometry.ts`; nothing else needs to change.
- The container fills 0.92 of the measured load span and then takes `container.webp`'s own
  2.58 aspect, which makes it chunkier than the box baked into `truck-side.webp` (aspect 3.05)
  — it stands about one cab-roof-height proud rather than flush. That is an asset mismatch,
  not a placement error; the footprint is centred on `deck.x0..x1` exactly.
- The overhead leg uses `truck-top-cut.webp`, whose container is baked in and pale grey — the
  one place the hero box is not the same element. A nadir view has no side elevation to
  composite onto, and the plan-view deck rect is aspect 5.24 against the container asset's
  2.58. It is a hard camera cut, which is the cheapest place to swap. A light
  `sepia(0.2) saturate(1.24) hue-rotate(-5deg)` warms the baked box toward the rust livery;
  sepia maps black to black so the tractor is untouched. **Do not increase it** — a stronger
  pass browns the whole truck.
- While the machine holds the box it is cut off at the left edge of frame — about 14% of its
  content width at `CLEAR_X`, more at wide-and-short viewports. This is forced: the machine's
  content is 0.51 world widths and the truck's is 0.53, so at the moment the crane has to
  stand clear of a reversing trailer they cannot both be fully in frame. It reads as the
  machine having backed off, which is what it is doing.
- The crane's placement pose overlaps the trailer's rear bogie, because `GROUND.crane` is
  downstage of `GROUND.truck` and the machine therefore draws in front of it. The trailer
  stays legible, but it is a deliberate depth read, not an accident.
- On the overhead run the truck holds the lane *left* of the centreline relative to travel,
  i.e. drive-on-right, while the crossroads stop lines in `components/yard/road.ts` were
  authored drive-on-left. Flip the sign on `LANE_OFFSET` in `components/yard/road.ts` if you
  want them to agree.
- The overhead carriageway is `#1B1B21`, not the literal `--color-night` `#0A0A0B`: at
  `#0A0A0B` the black tractor unit disappeared into the road. See `ASPHALT` in
  `components/yard/RoadPath.tsx`.
- Footer newsletter is optimistic UI only: it stores nothing and calls no endpoint.
- Footer column links and the legal row all point at `#top`; they are structure, not routes.
- `npm audit` reports 3 transitive, build-time-only findings inside `next@15.5.22`. The only
  offered fix is Next 16, which contradicts the pinned stack.
