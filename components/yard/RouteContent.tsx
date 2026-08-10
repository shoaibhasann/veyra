"use client";

import type { RefObject } from "react";

/**
 * The south run's flanking copy: the display headline on the white field left
 * of the carriageway, and the cards that SWAP on the right as the truck runs
 * down frame — each arriving with a rise-and-glow reveal the ticker drives.
 *
 * Static markup only: opacity, transform and the glow filter on every block
 * here are owned by YardSection's ticker.
 */
export interface RouteContentProps {
  /** The left headline + its paragraph. */
  leftRef: RefObject<HTMLDivElement | null>;
  /** One handle per right-hand card, in CARD order. */
  cardRefs: RefObject<HTMLDivElement | null>[];
}

/** Dot-matrix pictograms, same instrument language as the services strip. */
const PIN = [
  "...XXXXX....",
  "..X.....X...",
  ".X...X...X..",
  ".X..XXX..X..",
  ".X...X...X..",
  "..X.....X...",
  "...X...X....",
  "....X.X.....",
  ".....X......",
] as const;

const GLOBE = [
  "...XXXXXX...",
  ".XX...X..XX.",
  ".X....X...X.",
  "X..XXXXXX..X",
  "X.....X....X",
  "X..XXXXXX..X",
  ".X....X...X.",
  ".XX...X..XX.",
  "...XXXXXX...",
] as const;

const HEADSET = [
  "...XXXXXX...",
  "..X......X..",
  ".X........X.",
  ".X........X.",
  "XX........XX",
  "XX........XX",
  "XX........XX",
  "......XX..X.",
  ".......XXX..",
] as const;

function DotIcon({ rows }: { rows: readonly string[] }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows.length}`}
      className="h-11 w-auto"
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

export const ROUTE_CARDS = [
  {
    title: ["Live freight", "tracking"],
    icon: PIN,
    copy: "A fresh position every ninety seconds, straight from the cab to your dashboard — the same feed your customer is watching.",
  },
  {
    title: ["Network,", "end to end"],
    icon: GLOBE,
    copy: "Forty APAC lanes and the corridors between them, run as one operating layer with no hand-offs into the dark.",
  },
  {
    title: ["24/7 operations", "desk"],
    icon: HEADSET,
    copy: "A person, not a queue: the duty controller who owns your lane picks up around the clock.",
  },
] as const;

export default function RouteContent({ leftRef, cardRefs }: RouteContentProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* The headline owns the white field LEFT of the south arm. */}
      {/* Below the instrument cluster, not beside it: at 27% the display line
          ran straight through the speed readout and its odometer, which sit
          top-left of the same stage. */}
      <div ref={leftRef} className="absolute top-[38%] left-[4%] w-[34%] opacity-0">
        <p className="u-display text-[clamp(1.8rem,4vw,4.2rem)] leading-[0.95]">
          <span className="block text-ink/35">Reliability,</span>
          <span className="block">routed.</span>
        </p>
        <p className="mt-6 max-w-[38ch] text-sm leading-relaxed text-ink/65 sm:text-base">
          Every service under one roof and one accountable team — so the lane
          moves the way your business demands: predictably, transparently,
          without excuses.
        </p>
      </div>

      {/* The cards swap on the white field RIGHT of the arm, one per beat. */}
      {ROUTE_CARDS.map((card, i) => (
        <div
          key={card.title.join(" ")}
          ref={cardRefs[i]}
          className="absolute top-[34%] left-[64%] w-[30%] max-w-sm opacity-0 will-change-transform"
        >
          <span data-card-accent className="block text-ink">
            <DotIcon rows={card.icon} />
          </span>
          <h3 className="font-display mt-5 text-xl leading-tight font-bold tracking-tight uppercase sm:text-2xl">
            <span className="block">{card.title[0]}</span>
            <span className="block">{card.title[1]}</span>
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-ink/65 sm:text-base">{card.copy}</p>
        </div>
      ))}
    </div>
  );
}
