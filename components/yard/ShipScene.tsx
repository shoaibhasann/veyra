/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";

/**
 * THE SEA. Waiting under the road world's curtain: one 4K aerial VIDEO of
 * the vessel under way — ship locked dead-centre in frame while the royal
 * blue water, the hull foam and the churning wake run past it. The zoom
 * ("drone rising off the mid-deck") is OURS, a CSS scale on the plate, so
 * the same solved handoff arithmetic still holds; the water's life is the
 * footage's own and never depends on scroll.
 *
 * Static markup only. The zoom/pan wrapper, the headline and every card are
 * driven by YardSection's ticker.
 */
export interface ShipSceneRefs {
  /** The scene root — kept hidden until the sea act, or its dark ocean
      would underlie every earlier act the moment anything above is
      transparent. The ticker owns its visibility. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** The zoom + pan wrapper around the sea plate (videos + hero box). */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** The handoff loop — living water while the reader is still on the deck.
      The ticker parks it once the ascent has covered it. */
  loopRef: RefObject<HTMLVideoElement | null>;
  /** The ascent footage — ONE continuous shot with the drone rise baked
      in. The ticker scrubs its currentTime with the scroll. */
  ascentRef: RefObject<HTMLVideoElement | null>;
  /** The VEYRA box's transform wrapper — the ticker glues it to the
      footage's own white column as the baked ascent shrinks the vessel. */
  heroRef: RefObject<HTMLDivElement | null>;
  /** The display headline over the scene. */
  typeRef: RefObject<HTMLDivElement | null>;
  /** One handle per feature card, in SHIP_CARDS order. */
  cardRefs: RefObject<HTMLDivElement | null>[];
}

/** Dot-matrix pictograms — the instrument language, at sea. */
const ANCHOR = [
  ".....XX.....",
  "....X..X....",
  ".....XX.....",
  "..XXXXXXXX..",
  ".....XX.....",
  ".....XX.....",
  "X....XX....X",
  "X...XXXX...X",
  ".XXX.XX.XXX.",
  "....XXXX....",
] as const;

const SIGNAL = [
  ".....X......",
  "....XXX.....",
  "...X.X.X....",
  "..X..X..X...",
  ".....X......",
  ".....X......",
  "..XXXXXXX...",
  ".X.......X..",
  "X.........X.",
] as const;

const SEAL = [
  "...XXXXX....",
  "..X.....X...",
  ".X.......X..",
  ".X....X..X..",
  ".X.X.X...X..",
  ".X..X....X..",
  "..X.....X...",
  "...XXXXX....",
] as const;

const RATE = [
  ".....X......",
  "...XXXXX....",
  "..X..X......",
  "..X..X......",
  "...XXXX.....",
  ".....X..X...",
  "..X..X..X...",
  "...XXXXX....",
  ".....X......",
] as const;

function DotIcon({ rows }: { rows: readonly string[] }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows.length}`}
      className="h-10 w-auto"
      aria-hidden="true"
      focusable="false"
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "X" ? (
            <circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.34} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

export const SHIP_CARDS = [
  {
    title: ["One point of", "command"],
    icon: ANCHOR,
    copy: "A single desk owns the voyage — booking, documents and exceptions, end to end.",
    pos: { left: "8%", right: "auto", top: "30%", align: "left" as const },
  },
  {
    title: ["Visibility", "at sea"],
    icon: SIGNAL,
    copy: "Position, ETA and reefer telemetry stream ashore on the same feed you watched on the road.",
    pos: { left: "auto", right: "8%", top: "30%", align: "right" as const },
  },
  {
    title: ["Compliance,", "filed early"],
    icon: SEAL,
    copy: "Manifests and clearances lodged before the vessel sails — never after it berths.",
    pos: { left: "8%", right: "auto", top: "62%", align: "left" as const },
  },
  {
    title: ["Steady", "pricing"],
    icon: RATE,
    copy: "One quoted rate from gate to gate. No surprise surcharges mid-voyage.",
    pos: { left: "auto", right: "8%", top: "62%", align: "right" as const },
  },
] as const;

/** The sea footage's own pixel grid — every slot fraction is of THIS frame. */
export const SHIP_FRAME = { w: 3840, h: 2160 } as const;

/**
 * The hero seat, fractions of the video frame, measured off the footage
 * with a scanline probe (frames 0/60/239): the white centreline column runs
 * x 1913–1969 the whole clip (±2px), and the bay below mid-frame centres on
 * y ≈ 0.578 at the clip's midpoint. `len` is NOT the bay's own depth: it is
 * the slot width times the TRUCK deck's exact stretch ratio, so the hero box
 * has the truck container's proportions to the pixel — the size-sync the
 * handoff depends on. Seated white-on-white, so the footage's own ±11px of
 * swell drift never prints an edge.
 */
export const SHIP_SLOT = { x: 0.50547, y: 0.578, w: 0.014063, len: 0.13116 } as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The vessel's own bounds in the CLOSE footage, frame fractions — stern
    bridge to bow tip (scanline-measured). The hero's station derives here. */
export const SHIP_BODY = { cx: 0.5043, cy: 0.5347, h: 0.8648 } as const;

/**
 * THE ASCENT TRACK: the white centreline column's centre-x and width,
 * scanline-measured every ~1.25s of the baked drone-rise footage
 * (frames 30..320 of 361; t=0 restates the close-slot constants the first
 * second of locked hold shares). One continuous shot means the hero only
 * has to FOLLOW — x/w read straight off the pixels, and y comes from the
 * ship-relative station via the measured shrink, because the whole frame
 * scales uniformly with altitude.  [t seconds, x frac, w frac]
 */
export const ASCENT_TRACK = [
  [0.0, 0.50547, 0.014063],
  [1.25, 0.50573, 0.013542],
  [2.5, 0.50534, 0.01276],
  [3.75, 0.50469, 0.011719],
  [5.0, 0.50391, 0.010677],
  [6.25, 0.50299, 0.009635],
  [7.5, 0.50221, 0.008854],
  [8.75, 0.50013, 0.008073],
  [10.0, 0.49974, 0.007031],
  [11.67, 0.49974, 0.00599],
  [13.33, 0.4987, 0.004948],
  [15.0, 0.4987, 0.004167],
] as const;

/** The ascent clip's own clock: scrub window inside the 15.04s file. */
export const ASCENT = { tIn: 0.3, tOut: 14.6, duration: 15.04 } as const;

/**
 * Column sample → hero pose. The shrink s = w/w0 is the baked zoom itself;
 * the vessel settles lower in frame as the drone tops out (cy 0.535 →
 * 0.706, read off frames 0/180/357), and the hero keeps the SAME
 * ship-relative station below centre it has held since the crane.
 */
export function ascentSlotAt(t: number): { x: number; y: number; s: number } {
  const T = ASCENT_TRACK;
  let i = 1;
  while (i < T.length - 1 && T[i][0] < t) i++;
  const [t0, x0, w0] = T[i - 1];
  const [t1, x1, w1] = T[i];
  const f = clamp01((t - t0) / (t1 - t0));
  const x = x0 + (x1 - x0) * f;
  const s = (w0 + (w1 - w0) * f) / T[0][2];
  const cy = 0.5347 + 0.171 * ((1 - s) / 0.69);
  return { x, y: cy + 0.05 * SHIP_BODY.h * s, s };
}

export default function ShipScene({
  rootRef,
  wrapRef,
  loopRef,
  ascentRef,
  heroRef,
  typeRef,
  cardRefs,
}: ShipSceneRefs) {
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="invisible absolute inset-0 z-[1] overflow-hidden bg-[#0a2c5c] text-paper"
    >
      {/* THE SEA PLATE: two instants of ONE shot plus the hero box, a
          rigid unit under one CSS zoom. The loop plays the handoff's living
          water; the ascent — drone rise baked in — takes over under a
          scroll-scrubbed clock.

          BOTH SEAMS ARE SOLVED, not hoped for. The loop is cut as a real
          loop (its last frame is the frame before its first, so the wrap is
          one ordinary frame step, not a cut) and GRADE-MATCHED offline to
          the ascent's takeover frame: the source drifts ~7 units of blue
          across its ten seconds, which is what used to make the hand-over
          read as "the video changed". Measured water means now agree to
          under a unit, and the ticker cross-dissolves the last of it. */}
      <div
        ref={wrapRef}
        className="absolute top-1/2 left-1/2 will-change-transform"
        style={{
          width: `max(100vw, ${((SHIP_FRAME.w / SHIP_FRAME.h) * 100).toFixed(2)}svh)`,
          aspectRatio: `${SHIP_FRAME.w} / ${SHIP_FRAME.h}`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* NEITHER CLIP FETCHES ITSELF. 68MB of ocean has no business
            downloading for a reader who never leaves the hero, and most
            never do — the yard primes both when it comes within a viewport
            of the fold, which leaves it twenty-one viewports of scrolling
            before the sea act needs a frame. `autoPlay` is gone for the
            same reason: it is an intent to play, which browsers honour over
            a preload hint, and the ticker starts this clip anyway the
            moment the sea act opens. */}
        <video
          ref={loopRef}
          src="/assets/sea-loop.mp4"
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 block h-full w-full select-none"
          style={{ objectFit: "fill" }}
        />
        <video
          ref={ascentRef}
          src="/assets/sea-ascent.mp4"
          muted
          playsInline
          preload="none"
          className="absolute inset-0 block h-full w-full opacity-0 select-none"
          style={{ objectFit: "fill" }}
        />
        {/* THE container — the same top plate the crane placed and the
            truck carried, stretched to the truck deck's exact proportions.
            The wrapper's transform (ticker-owned, origin 0 0) rides the
            measured ascent track, so the box shrinks and drifts WITH the
            footage's own white column, VEYRA text and all. */}
        <div
          ref={heroRef}
          className="absolute top-0 left-0 will-change-transform"
          style={{
            width: `${(SHIP_SLOT.w * 100).toFixed(4)}%`,
            aspectRatio: `${((SHIP_SLOT.w * SHIP_FRAME.w) / (SHIP_SLOT.len * SHIP_FRAME.h)).toFixed(4)}`,
            transformOrigin: "0 0",
          }}
        >
          <img
            src="/assets/container-hero.webp"
            alt=""
            decoding="async"
            draggable={false}
            className="block h-full w-full select-none"
            style={{
              objectFit: "fill",
              filter: "drop-shadow(-2px 3px 4px rgba(6, 18, 38, 0.38))",
            }}
          />
        </div>
      </div>

      {/* The display line over the scene. */}
      <div
        ref={typeRef}
        className="absolute inset-x-0 top-[18%] px-6 text-center opacity-0 will-change-transform"
      >
        <p className="u-display text-[clamp(2.4rem,6.5vw,6.5rem)] leading-[0.95]">
          <span className="block">Every nautical mile,</span>
          <span className="block">accounted for.</span>
        </p>
      </div>

      {/* Feature cards flanking the vessel, one reveal per beat. */}
      {SHIP_CARDS.map((card, i) => (
        <div
          key={card.title.join(" ")}
          ref={cardRefs[i]}
          className="absolute w-[26%] max-w-sm opacity-0 will-change-transform"
          style={{
            left: card.pos.left,
            right: card.pos.right,
            top: card.pos.top,
            textAlign: card.pos.align,
          }}
        >
          <span
            data-card-accent
            className="block text-paper"
            style={{ marginLeft: card.pos.align === "right" ? "auto" : undefined, width: "fit-content" }}
          >
            <DotIcon rows={card.icon} />
          </span>
          <h3 className="font-display mt-4 text-lg leading-tight font-bold tracking-tight uppercase sm:text-2xl">
            <span className="block">{card.title[0]}</span>
            <span className="block">{card.title[1]}</span>
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-paper/70 sm:text-base">{card.copy}</p>
        </div>
      ))}

    </div>
  );
}
