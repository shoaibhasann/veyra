# /public/textures

Runtime texture assets for the WebGL scenes.

The repo intentionally ships with **zero required texture files** for the hero
globe — it renders from procedurally generated geometry so `npm run build`
never depends on a binary asset. Everything below is optional.

---

## Hero globe land mask

`components/scenes/Globe.tsx` draws its continents as a dot matrix: ~16,000
points are distributed over a sphere with Fibonacci sampling, then each one is
tested against an **equirectangular land mask** and discarded if it lands on
water.

By default that mask is rasterised in code from a small set of simplified
coastline rings (`lib/globe/coastlines.ts`) onto an offscreen 2D canvas. No
network request, no asset dependency.

### Swapping in a real mask

Drop a file at `public/textures/earth-mask.png` and change **one line** in
`lib/globe/landmask.ts`:

```ts
// from
export const LAND_MASK_SOURCE: LandMaskSource = {
  kind: "procedural",
  width: 1024,
  height: 512,
};

// to
export const LAND_MASK_SOURCE: LandMaskSource = {
  kind: "image",
  url: "/textures/earth-mask.png",
};
```

Nothing else changes. Both branches rasterise into the same offscreen canvas
and are read back through the same `isLand(lat, lng)` sampler, so the dot
builder, the arcs and the shaders are all untouched.

### Mask requirements

| Property     | Value                                                     |
| ------------ | --------------------------------------------------------- |
| Projection   | Equirectangular (plate carrée), full globe                 |
| Bounds       | lng `-180…180` left→right, lat `90…-90` top→bottom         |
| Aspect ratio | Exactly 2:1                                                |
| Resolution   | 1024×512 is plenty; 2048×1024 is the useful ceiling        |
| Encoding     | Greyscale or RGB. **Land ≥ 128, water < 128** on the red channel |
| Alpha        | Ignored — do not encode land in the alpha channel          |
| Origin       | Must be same-origin (it is read back via `getImageData`)   |

Dots end up roughly 1° apart, so detail finer than ~0.5° per pixel is wasted.
A hard black-and-white mask beats an antialiased one; soft coastlines make the
`> 127` threshold produce a ragged edge.

### Sourcing a mask

Public-domain options include NASA Visible Earth / Blue Marble land-water
masks and Natural Earth vector land rasterised to 2:1. Check the licence of
anything you commit here.

---

## Other scenes

The ocean scene (`components/scenes/Ocean.tsx`) is owned by another module and
declares its own texture needs separately — see its notes rather than this
file.
