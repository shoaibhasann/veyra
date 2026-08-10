# Assets — what ships, and how to replace it

`YardSection` — the one continuous yard narrative — runs on **photoreal stills
in `public/assets/`**, layered and transformed at runtime. They are not frame
sequences and not runtime 3D. This document covers what those assets are, the
measured geometry the rig depends on, how to swap in better artwork, and — from
§5 onward — the frame-sequence playbook, which is still live for the day a real
pre-rendered camera move is needed.

---

## 1. What ships today

Every asset exists three times: a PNG master, a `-cut` variant with the white
keyed to alpha, and a `.webp` encode of each. **The app loads only the WebP.**

| Asset | Size | What it is | Used by |
| --- | --- | --- | --- |
| `reachstacker` | 2688×1536 | teal container reach stacker, strict side elevation, boom **fixed** at ~45° up-and-right, yellow/black hazard spreader at the tip | `ReachStacker` (`-cut`) |
| `container` | 2688×1536 | 40 ft container, flat side elevation, pale blue-grey corrugated | `ContainerBox` ×3 (plain, cropped — see the warning below) |
| `truck-empty` | 2720×1536 | black tractor + **bare skeletal trailer, no container**, strict side elevation, **cab facing right** | `TruckRig` (`-cut`) |
| `truck-side` | 2688×1536 | the **same** truck **with** a container loaded, same camera and scale | reference only — never loaded at runtime |
| `truck-empty-top` | 2720×1536 | the empty truck from directly overhead (nadir) | reference only — never loaded at runtime |
| `truck-top` | 2688×1536 | the **loaded** truck from directly overhead, pointing right — roofs only, wheels protruding both sides | `TruckTopRig` (`-cut`) |
| `wheel` | 2048×2048 | one truck wheel, dead-on, a true circle, centred; black tyre, silver rim, **8** bolt holes | five overlays in `TruckRig` (`-cut`) |

**Empty vs. loaded is the whole point of the narrative.** The user-facing story
is: a truck arrives with *nothing* on its trailer, the reach stacker sets a
container onto the bare deck, and only then does the truck leave loaded. That
requires two masters shot from the same camera at the same scale —
`truck-empty` (what the runtime shows for the whole side-elevation leg) and
`truck-side` (the loaded reference the deck line was solved against). The
runtime never swaps one for the other: the container that lands on the empty
trailer is the same `ContainerBox` element the crane was holding a frame
earlier. `truck-side.webp` and `truck-empty-top.webp` ship as measurement
references and are not requested by the page.

**The deck line.** `truckEmpty.deck` in the manifest is
`{ y: 0.547266, x0: 0.09375, x1: 0.590774 }` — source fractions of the empty
truck's own 2720×1536 canvas. `y` is the plane a container's **bottom edge**
rests on; `x0..x1` is the **load span**, i.e. where a container actually sits,
derived by projecting the loaded `truck-side` master's baked container onto the
empty trailer — deliberately *not* the wider span of visible rail, which would
put the box's footprint over thin air. `components/yard/geometry.ts` turns it
into world space:

```ts
DECK_Y  = TRUCK_TOP_Y + deck.y * TRUCK_H;    // the box's resting plane
DECK_CX = (deck.x0 + deck.x1) / 2;
BOX_W   = 0.92 * (deck.x1 - deck.x0) * TRUCK_W;
GROUND.stack = DECK_Y - SETTLE;              // so the free fall is exactly SETTLE
```

The deck is not perfectly level in the render (see `_checks.deckIsNotLevel` in
the manifest); the single `y` is the mean, which is within a pixel of the load
span's own ends.

Whole set: **15.83 MB of PNG → 920.9 KB of WebP**, 94.3% smaller, PSNR
45.3–53.7 dB against the masters (visually lossless; the corrugation and the rim
machining were compared at 4× zoom and are indistinguishable).

Re-encode with:

```bash
./scripts/optimise-assets.sh
# cwebp -q 88 -m 6 -pass 6 -sharp_yuv -alpha_q 100 -metadata none
```

It uses `cwebp`, not ffmpeg — this machine's Homebrew ffmpeg has no libwebp and
cannot write WebP at all. PNG masters are kept on disk; keep it that way.

### Cut-out warnings

| File | Status |
| --- | --- |
| `container-cut` | **BROKEN — do not use.** The keyer treated the bright faces of the corrugation as background, so the alpha has vertical see-through stripes across the whole box; 7.6% of pixels inside the content box are transparent despite being clearly non-white. Confirmed by compositing over magenta. `ContainerBox` uses plain `container.webp` cropped to its content box instead. |
| `wheel-cut` | Usable. The 8 bolt holes and the hub bore are genuinely transparent — correct, but they show whatever is behind the wheel. Over a dark background the rim can read as punched out. |
| `truck-side-cut` | Usable, but not loaded at runtime. Retains a faint semi-transparent ground shadow (alpha ~128–200) as a band around y≈1045–1062 stretching left to x=69, well outside the vehicle. The measured content box deliberately excludes it. |
| `truck-empty-cut` | Usable — this is the one the page actually loads. Same shadow caveat as `truck-side-cut`; the content box excludes it. |
| `truck-top-cut` | Clean, 0.008% keyed away. Its container is **baked in** and pale grey — the overhead leg is the one place the hero box is not the same element, which is why the swap happens across a hard camera cut. |
| `reachstacker-cut` | Clean, 0.071% keyed away. |

---

## 2. The manifest — measured, not eyeballed

`public/assets/manifest.json` is the source of truth for every position the rigs
use. **Every value is a fraction (0..1) of that image's own dimensions**: `x`/`w`
of image width, `y`/`h` of image height, radii of image **width**. Both vehicle
masters have square pixels and render with preserved aspect, so multiplying a
radius by the element's rendered width gives a radius correct on both axes.

It carries, per asset: a tight `contentBox` (the vehicle only — excludes the
white margin *and* the soft ground shadow), the reach stacker's `spreaderTip`
**and** its `spreaderGripX` / `spreaderGripY` / `spreaderGripSpan`, the wheel
image's hub centre and mean tyre radius, the five wheel circles for both the
loaded and the empty truck, and a `deck` rect for every trailer variant.

**Grip, not tip.** `reachStacker.spreaderTip` `{x: 0.745, y: 0.348}` is the
hazard beam's front *face*. The surface a container actually touches is
`spreaderGripX = 0.728051` — 1.73% of the canvas to its left — with
`spreaderGripSpan = 0.639137 .. 0.816964`. Anchoring the container to
`spreaderTip.x` is exactly what produced the visible gap in the previous build.
The rig uses `GRIP` / `GRIP_SPAN` in `components/yard/geometry.ts`, which mirror
the grip values. `_checks.spreaderGripX_thisIsProbablyTheGapBug` in the manifest
records the same finding.

None of it was measured by eye. Each PNG was decoded to raw RGBA
(`ffmpeg -pix_fmt rgba`) and analysed with plain Node:

- **Content boxes** — thresholded distance-from-pure-white, requiring ≥4 content
  pixels per row/column to reject specks, with the threshold swept
  20/30/40/50/65/80 and the value taken from the plateau where the box stops
  moving. This matters: below the plateau the drop shadow registers, and
  trusting the `-cut` alpha naively gave a `truckSide` left edge of x=69 (pure
  shadow) against the true vehicle edge at x=250. Confidence: ±2 px on every edge.
- **The five wheel centres** — a gradient Hough transform. Every strong Sobel
  edge pixel votes for a centre at distance r (35–125 px) along both directions
  of its gradient; the hub, bolt circle, rim edge and tyre edge are concentric,
  so they pile onto one point. Five peaks scored 12,947–23,152 against 3,918 for
  the sixth candidate — clean separation, no threshold tuning. A second Hough
  over r=22–58 px (inner rim only, never occluded by the wheel arch) moved them
  by 0.4–1.4 px, independently confirming the first pass. Confidence: ±1 px.
- **Wheel radii** — local ground line minus centre y, where the ground line is
  the lowest vehicle pixel within ±20 px of each `cx`. That is exact, because a
  tyre's lowest point *is* its ground contact and nothing is below a wheel. A
  free 3-parameter circle fit was tried first and **rejected**: the tandem tyres
  physically touch (the pixels between them are solid black) and the arch hides
  the upper arc, so `cy` and `r` trade off along the only visible arc and the fit
  diverged to radii of 37–142 px. Confidence: ±2 px.

**Do not average the five radii for placement.** They fall 87.2 px → 81.0 px left
to right because the render carries a slight perspective — the ground line rises
from y=1066 under the trailer to y=1060 under the steer axle. That is a real
property of the image. Averaging drifts the overlays by up to 6 px.

### The manifest is mirrored into TypeScript

The app imports `lib/assetGeometry.ts`, **not** the JSON. That module holds the
numbers only — no prose — and lives outside `public/`, so nothing bundles the
~6 KB of measurement notes and nothing imports a module out of the static-asset
directory. It is generated:

```bash
node scripts/sync-geometry.mjs        # manifest.json -> lib/assetGeometry.ts
```

**Editing `manifest.json` alone changes nothing at runtime.** Always re-run the
sync, then `npx tsc --noEmit`.

---

## 3. The wheel formula

This is the whole reason the truck reads as real. A wheel must rotate in
proportion to distance travelled, never at a fixed rate, or the eye instantly
reads it as skidding on ice:

```ts
const circumference = Math.PI * wheelDiameterPx;
const rotationDeg   = (distanceTravelledPx / circumference) * 360;
```

Two rules make it work:

1. **`distanceTravelledPx` must come from the same scroll-derived value that
   moves the vehicle.** In `YardSection` that is `rolledUnits(p)`, read by
   `useWheelRotation` and taken straight off the truck's own `truckXAt(p)` plus
   the overhead leg's `pathDistance(p)`. Nothing is stateful, so scrubbing
   backwards retraces exactly — verified: every sampled scroll position returns
   an identical wheel angle on the way back up.
2. **It must be signed, not absolute.** The truck *reverses* into the bay (it
   enters from the right moving left, with the cab facing right) and then pulls
   away forwards to the right. Because `rolledUnits` is signed off the truck's
   own x, the wheels counter-rotate on the way in and rotate forwards on the way
   out with no special-casing. Taking `Math.abs()` anywhere in that chain
   reintroduces the skid.

Sizing an overlay so its tyre matches a baked-in wheel:

```
overlayWidthPx = (truckEmpty.wheels[i].r / wheel.r) * renderedTruckWidthPx
```

Then place the overlay's **hub** — `wheel.cx` / `wheel.cy`, which is offset from
the image's bbox centre — on `wheels[i].cx` / `wheels[i].cy` of the rendered
truck, and rotate about that point. `WHEEL_PLACEMENTS` in
`components/yard/geometry.ts` precomputes exactly that, off `truckEmpty.wheels`
(all five at `cy ≈ 0.6377`), and the same maths holds for `truckSide` — the two
masters' wheel circles agree to well under a pixel.

Note `useWheelRotation` takes one diameter for all refs, so `WHEEL_DIAMETER_FRAC`
passes the mean and each wheel is within ~3% of its own true rolling rate.
Placement and scale still use the individual radius.

---

## 4. Swapping in higher-quality assets

The rigs are data-driven, so better artwork is not a code change.

1. **Match the framing.** New masters must be the same *kind* of image: strict
   side elevation for `truck-empty` / `truck-side` / `reachstacker` /
   `container`, true nadir for `truck-top` / `truck-empty-top`, a dead-on centred
   circle for `wheel`. Keep the canvas aspect (2688×1536, or 2720×1536 for the
   empty pair) and keep the cab facing **right**. `truck-empty` and `truck-side`
   must be the **same truck from the same camera at the same scale** — the deck
   line is solved by projecting one onto the other, and a mismatch there breaks
   the placement. Produce both the plain and the `-cut` variant.
2. **Same filenames.** `public/assets/<name>.png` and `<name>-cut.png`.
3. `./scripts/optimise-assets.sh`
4. **Re-measure into `manifest.json`** using the methods in §2 — content boxes,
   the wheel circles for both trucks, the wheel hub centre and mean tyre radius,
   the spreader tip **and grip**, and the `deck` rect for every trailer variant.
   Draw the results back onto the source image and inspect at 4× before trusting
   them.
5. `node scripts/sync-geometry.mjs`
6. `npx tsc --noEmit`, then scrub `YardSection` in a browser at desktop and phone
   widths, and re-run the §12 measurements. The pick and the placement are stated
   in code as *equalities*, so a stale measurement does not warn — it just
   silently re-opens the gap.

**A cheap end-to-end check for the wheels:** scale `wheel-cut` by
`wheels[i].r / wheel.r`, put its hub at `(cx, cy)`, rotate it ~25°, and
composite it tinted over `truck-side.png`. All five overlays should cover the
baked tyres with no crescent, and the bolt circle should stay single under
rotation.

`reachStacker.spreaderTip` is the one value with a judgement call in it: it is
defined as the front **face** of the hazard beam, not the outermost tip of the
boom assembly (that is the content box's right edge, x = 0.844494) and **not**
the surface a container touches. For the rig you want `spreaderGripX` /
`spreaderGripY` — see §2.

**A note on the machine's scale.** The reach stacker is a single still, so its
boom cannot telescope or luff, and the rig never stretches, skews or scales it to
fake extension. Something must still be solved so the spreader's fixed contact
plane lands exactly on the top face of a box standing on the stack ground.

Solving `STACKER_W` for that is the obvious choice and it is the wrong one. This
render's spreader head spans `0.639137..0.816964` of the canvas — 0.178, about a
third of a 40ft box — where a real 40ft spreader is a little *longer* than its
load. Size the machine from the contact identity and it comes out **narrower
than the container it is holding**: the box then covers the boom and the cab, and
the beat reads as impaled rather than held. That is a worse failure than the gap
the identity exists to close, and it is invisible to the measurement, which still
reports zero.

So `STACKER_W = 0.92` is authored, and the machine's ground line is solved:

```ts
GROUND.crane = GROUND.stack - BOX_H + (STACKER_GROUND - GRIP.y) * STACKER_H;
```

The identity is exactly as tight, the machine reads at 2.56× the loaded truck's
body height (a real one is ~2.5×), and the held box clears the boom. The solved
lane lands at 1.016, **below** the truck's 0.855, so the machine is downstage and
`ReachStacker` must render after `TruckRig`. Re-scale the machine if you like —
but re-check that draw order against the sign of `GROUND.crane - GROUND.truck`.

---

## 5. Route 1 — free, best quality: CC0 model → Blender

Everything from here down is the **frame-sequence** playbook. No section uses it
today; `components/FrameSequence.tsx` and `hooks/useFrameSequence.ts` are kept
working for the day a real pre-rendered camera move is needed — something
layered 2D genuinely cannot fake. `public/frames/` is empty and is where such a
sequence would land.

This is the route that produces something you would actually ship. It costs
time, not money.

### 5.1 Find a model

Go to Sketchfab and search, then set **two** filters in the sidebar:

- **Downloadable** — on
- **License** — CC0 (Public Domain)

<https://sketchfab.com/search?features=downloadable&type=models>

The license filter is the one people forget. Sketchfab's default results include
a large number of models that are downloadable but **CC-BY**, which is a
different obligation entirely — see §7.

Good search terms: `container crane`, `gantry crane`, `ship to shore crane`,
`semi truck`, `articulated lorry`, `cargo truck`. Prefer models with clean
topology and separate objects for the moving parts (trolley, hook, wheels) —
if the whole crane is one welded mesh you cannot animate the trolley.

Download **glTF** (`.glb` or `.gltf`) if it is offered. It carries materials and
transforms correctly and imports into Blender without a conversion step.

### 5.2 Blender is not installed

Get it from <https://www.blender.org/download/>. It is free and around 300 MB.
The manual is at <https://docs.blender.org/manual/en/latest/>.

`ffmpeg` **is** already installed (`/opt/homebrew/bin/ffmpeg`), so everything
downstream of the render works right now.

### 5.3 Exact Blender steps

1. **Import.** `File ▸ Import ▸ glTF 2.0 (.glb/.gltf)`, pick the downloaded
   file. Delete the default cube if it is still there.

2. **Frame range.** In the timeline at the bottom, set **Start `0`** and
   **End `169`**. Not 1–170. `FrameSequence` reads `frame_000` … `frame_169`,
   and matching the range here means you never rename anything.

3. **Resolution.** Output Properties (the printer icon) ▸ Format ▸
   **Resolution X `1566`**, **Y `880`**, **%** `100`.

4. **Output path and format.** Output Properties ▸ Output.
   Set the path to something like `//render/frame_###`. The three `#` give
   three-digit zero padding, which produces `frame_000.png` … `frame_169.png`
   directly.
   File Format **PNG**, Color **RGBA** for a transparent background or **RGB**
   for white, Color Depth `8`, Compression `15%`.

5. **Transparent background.** Render Properties ▸ Film ▸ tick **Transparent**.
   Skip this if you want the frames rendered onto a solid backdrop instead —
   in which case add a large plane behind the subject and light it.

6. **Animate something.** Nothing moves unless you make it. Pick one:
   - *Object motion.* Select the trolley (or the whole truck), go to frame 0,
     press `I` ▸ `Location`. Go to frame 169, move it, press `I` ▸ `Location`
     again. Two keyframes is a complete animation.
   - *Camera orbit.* Add an Empty at the model's centre, parent the camera to it
     (select camera, shift-select empty, `Ctrl+P`), then keyframe the empty's
     Z rotation `0°` at frame 0 and `360°` at frame 169. Set the interpolation
     to Linear in the Graph Editor or the orbit will ease at both ends and the
     scrub will feel sticky.

7. **Pick an engine.** Render Properties ▸ Render Engine.
   **EEVEE** renders 170 frames in minutes and is the right default here.
   **Cycles** looks better and can take hours for the same 170 frames — check
   the per-frame time on a single `F12` render and multiply by 170 before you
   commit to it.

8. **Render.** `Render ▸ Render Animation` (`Ctrl+F12`). Blender writes the PNG
   sequence to the output path.

### 5.4 Convert the render

```bash
./scripts/optimise-frames.sh /path/to/render --webp --avif
```

That reads the PNG masters, writes both formats beside them, and prints the
before/after totals. Then copy the format you want into `public/frames/yard/`.

Add `--replace` to delete the PNG masters afterwards — but keep them somewhere
outside the repo. They are the only lossless copy you have, and re-encoding a
lossy file into another lossy format stacks artefacts.

---

## 6. Route 2 — paid, fastest: AI image-to-video

Generate a still, feed it to an image-to-video model, get an mp4 back, cut it
into frames.

```bash
./scripts/video-to-frames.sh ~/Downloads/yard.mp4 public/frames/yard 170
```

The extractor handles the rest: it probes the true frame count, selects exactly
170 evenly-spaced frames, cover-crops to 1566×880 and writes WebP.

Tools worth trying: **Higgsfield**, **Kling**, **Runway**, **Luma Dream
Machine**. Deliberately no URLs here — this category rebrands and changes
domains often enough that a link written today is a liability. Search for the
current official site and check the pricing page before signing up.

### Be honest about what this route is good for

Generated video **drifts**. The model is not simulating a crane; it is
predicting plausible next frames. Over a 5-second clip a hard-surface object
will subtly change proportion, panel lines will wander, wheel counts change,
lettering turns to mush, and straight edges breathe. You cannot ask for
"the trolley travels exactly 900px left to right and the hook descends 300px"
and get it.

That makes it a poor fit for exactly the thing we need it for — **a
hard-surface machinery close-up is the worst case for this technique.** Any
scroll sequence puts the viewer in complete control of the playhead. They will
scrub slowly, backwards, and hold on a frame. Drift that is invisible at 24fps
playback is glaring when someone parks on frame 84.

It also cannot loop or be controlled precisely, so a sequence that needs to
start and end in the same state is out.

Where it genuinely works: **atmospheric** shots. Fog rolling over a container
yard, sea state under a hull, rain on a windscreen, headlights sweeping a
depot at night, aerial drift over a port. Soft subjects, no rigid geometry for
the eye to lock onto, no precise start/end state. Used that way it is by far
the fastest route to something that looks expensive.

Practical rule: **Route 2 for backgrounds and mood, Route 1 for the machinery.**

---

## 7. Route 3 — free CC0 model sources

| Source | URL | Licence | Notes |
| --- | --- | --- | --- |
| Sketchfab (filtered) | <https://sketchfab.com/search?features=downloadable&type=models> | mixed — **must filter** | Much the largest catalogue. Set *Downloadable* **and** *License: CC0*. Best odds of finding a specific real crane or truck. |
| Poly Haven | <https://polyhaven.com/models> | CC0 | Small catalogue, uniformly high quality, correct scale and PBR materials. Also the best free source of HDRIs — <https://polyhaven.com/hdris> — which is the fastest way to light a render decently. |
| Quaternius | <https://quaternius.com/> | CC0 | Large stylised low-poly packs, includes vehicles. Renders fast. Reads as illustration, not photoreal. |
| Kenney | <https://kenney.nl/assets> | CC0 | Game-oriented, very low poly, strong consistency within a pack. Good for a stylised diagram look. |

### The CC-BY caveat, spelled out

**CC0** is public domain dedication. Use it commercially, modify it, ship it,
credit nobody. Nothing to track.

**CC-BY** requires attribution, and that requirement does not disappear because
the model has been rendered to a 2D image sequence. If you render a CC-BY crane
into 170 frames and put those on a client's marketing site, the client's site
must carry the credit — author name, and typically the source link and licence.
For a premium marketing site that usually means a credits line in the footer or
a `/credits` page, which is a design and legal conversation, not a technical
one.

Other terms you will meet in Sketchfab results:

- **CC-BY-NC** — non-commercial. Unusable for client work. Not negotiable by
  adding a credit.
- **CC-BY-ND** — no derivatives. Rendering it is arguably fine; modifying the
  mesh is not. Avoid it, the ambiguity is not worth it.
- **Sketchfab Standard / Editorial** — proprietary store licences with their own
  restrictions. Read them; they are not Creative Commons.

For client work the safe rule is **CC0 only**, unless someone has explicitly
signed off on carrying attribution. Record the model URL and licence for every
asset you pull, at the time you pull it — reconstructing that six months later
is miserable.

---

## 8. Budget

| Item | Cost | Notes |
| --- | --- | --- |
| ffmpeg | **free** | already installed |
| Blender | **free** | not installed yet — <https://www.blender.org/download/> |
| CC0 models (all four sources in §7) | **free** | |
| Poly Haven HDRIs for lighting | **free** | |
| The scripts in `scripts/` | **free** | |
| The photoreal masters | **already paid for** | in `public/assets/`, 920.9 KB of WebP for the whole set |
| Your render time | free, but real | EEVEE minutes vs Cycles hours for 170 frames |
| **Route 1 total** | **$0** | time is the only cost |
| AI image-to-video (Higgsfield / Kling / Runway / Luma) | **paid** | subscription or credits; a usable 5s clip typically takes several regenerations, so budget for more than one |
| Sketchfab Pro | paid, **not needed** | free tier downloads CC0 models fine |
| Paid model marketplaces (TurboSquid, CGTrader et al) | paid | only if no CC0 model fits; check the licence covers web/commercial use |
| Stock footage (Artgrid, Filmsupply) | paid | a legitimate Route 2 alternative with no drift — real footage, run through `video-to-frames.sh` |

The genuinely free path is complete end to end. Money only buys speed, and in
the AI-video case it buys speed at the cost of control.

---

## 9. Measured numbers

Frame-sequence encoding figures, measured on the placeholder sequences this
project used to ship (1566×880, PNG masters, WebP q82 vs AVIF CRF 32 on this
machine). Those frames are gone, but the numbers are the reference point for
sizing any future sequence.

| Content | WebP q82 | AVIF CRF 32 | AVIF saving |
| --- | --- | --- | --- |
| Photographic | 294.1 KB / 8 frames | 195.3 KB / 8 frames | **33.6%** |
| Flat synthetic | 22.3 KB / frame | 5.4 KB / frame | **75.9%** |
| 170-frame sequence | 6.6 MB | 4.9 MB | **26%** |

**Decode.** Decoding all 170 frames single-threaded came out at ~9.2 ms/frame
for **both** formats — no measurable AVIF penalty. The usual "AVIF decodes
slower" warning did not reproduce here; dav1d's ARM NEON paths are very good,
and Chrome and Firefox ship dav1d too. It remains a real risk on older hardware,
so measure on your actual target devices rather than assuming either way.

**Encode.** AVIF is ~2.7× slower to encode — 0.170 s/frame against 0.062 s/frame.
Build-time only, paid once.

`FrameSequence` defaults to `ext: "webp"` for reach, not performance: Safari only
shipped AVIF in 16.4. Generate both, test on a real phone, then decide.

---

## 10. Toolchain notes

Two things about this machine's ffmpeg cost real time to discover, and will bite
anyone extending these scripts:

- **No `libwebp`.** Homebrew's ffmpeg is not built with it, so ffmpeg cannot
  write WebP at all. All three scripts detect this and shell out to `cwebp`
  (from the `webp` formula) instead. If `cwebp` is missing: `brew install webp`.
- **No freetype, so no `drawtext`.** There is no way to render text through
  ffmpeg on this build. `make-placeholder-frames.sh` works around it with a
  hand-rolled 5×7 pixel font that it writes out as an ASCII PGM — which
  ffmpeg's pnm decoder reads happily — then scales nearest-neighbour and uses
  as an alpha mask.

AVIF encoding works via `libsvtav1` plus ffmpeg's `avif` muxer, and does
preserve 1566×880 exactly.

## 11. Verifying a sequence

Whatever route produced them, check before wiring them up:

```bash
ls public/frames/yard/frame_*.webp | wc -l                      # must equal `count`
ls public/frames/yard | head -1; ls public/frames/yard | tail -1
ffprobe -v error -show_entries stream=width,height \
        -of csv=p=0 public/frames/yard/frame_000.webp           # must be 1566,880
du -sh public/frames/yard                                       # transfer budget
```

The count must match the `count` prop passed to `FrameSequence`, the padding
must be 3 digits starting at `000`, and every frame must be the same dimensions
— a single odd-sized frame makes the canvas jump on exactly one scroll position,
which is a genuinely horrible bug to find by eye.

---

## 12. Verifying the rig

The layered rig has no frame count to check, so verify the geometry instead.
Screenshots are not enough — measure. The section renders every pose as a pure
function of one progress number, so all of this can be driven from the console:
scroll to `pinSpacerTop + 9900 * p`, let the 0.45 scrub settle, then read live
`getBoundingClientRect()`s.

**Wheel registration.** Blow the side wrapper up to a few thousand pixels wide in
DevTools and invert the overlays. At that magnification the overlay tyre should
cover the baked tyre with no crescent anywhere, and the bolt circle must stay
single under rotation. A drifting overlay means the manifest radius or hub is
stale.

**Wheel ↔ body lock.** Read the wheel's computed transform and the truck's own
translate at the same scroll position; they must agree on one distance:

```
rolled ≡ (deg / 360) * π * wheelDiameterPx     (mod the circumference)
rolled ≡ rolledUnits(p) * worldWidthPx
```

If they disagree, something is driving the wheels from a different value than the
body — the one failure this whole approach exists to prevent. Check the sign too:
the wheels must counter-rotate while the truck reverses into the bay.

**Container attachment — the important one.** This is the check the previous
build failed. Sample the timeline and measure the hero `ContainerBox`'s rect
against the spreader hairline's rect (the hairline is a 2 px rule with
`margin-top: -1px`, so its `top` sits 1.00 px above the contact plane by
construction):

```
p in (PICK, DROP):   box.top   - lock.top    ==  1.00 px      // zero gap
                     box.midX  - lock.midX   ==  0.00 px      // centred on the grip
p > DROP_END:        box.bottom sits on DECK_Y, box.midX on the load-span centre
```

Measured at a 1440×900 viewport (world 1404×802): 1.00 px / 0.12 px at the lock
(p=0.175), 1.00 px / 0.02 px right through the carry (p=0.22 → 0.46), and
**identical numbers on a reverse scrub** back through 0.30 and 0.24. Anything
that drifts means something is being animated independently instead of derived
from its parent in the same frame.

**Riding the trailer.** After release, `boxCX - truckCX` must be constant.
Measured: −146.16 px at p = 0.56 / 0.62 / 0.70. It changes by ~3.4% at p=0.76 —
that is the camera push scaling the whole side layer uniformly, not drift.

**Reverse scrub.** Sample a set of scroll positions going down, then the same set
coming back up. Every derived value must be identical both ways. Anything that
differs is stateful and will drift.

**Pins.** At desktop widths there must be exactly **one** `.pin-spacer` element,
and the next section must start exactly where it ends — see the table in
README.md (measured: spacer 2714 → 12614, `ServicesSection` at 13514 = 12614 +
one viewport). At ≤768px there must be **zero**, and the section must be exactly
one viewport tall.
