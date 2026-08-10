"use client";

import type { RefObject } from "react";
import { DRIVE, pct } from "./geometry";

/**
 * REF FRAME 4 — the roadside. Everything the truck drives PAST during the
 * follow: the giant ghost wordmark on the paper band and the services cards on
 * the night band. Screen-space, deliberately: the strip translates by the
 * drive's own distance parameter in the section's ticker, so its speed and the
 * tyres' cannot disagree, while its type stays perfectly crisp (it never rides
 * the scaled world layer).
 *
 * Static markup only. Both wrappers' transforms are owned by YardSection's
 * ticker — nothing here may declare one, or a React re-render would tear a
 * frame in half.
 */
export interface FollowStripProps {
  /** The ghost wordmark row, translated on the paper band. */
  ghostRef: RefObject<HTMLDivElement | null>;
  /** The card strip, translated on the night band. */
  stripRef: RefObject<HTMLDivElement | null>;
}

/**
 * Dot-matrix pictograms, in the reference's instrument language: a small
 * bitmap of round pixels, not an outline icon. 'X' is a dot.
 */
const PLANE = [
  ".....X......",
  ".....X......",
  "....XXX.....",
  "....XXX.....",
  "X..XXXXX..X.",
  "XXXXXXXXXXXX",
  ".....X......",
  ".....X......",
  "...XXXXX....",
] as const;

const SHIP = [
  ".....X......",
  ".....XX.....",
  "...XXXX.....",
  "...XXXX.....",
  "XXXXXXXXXXXX",
  ".XXXXXXXXXX.",
  "..XXXXXXXX..",
] as const;

const STAMP = [
  "...XXXXX....",
  "..X.....X...",
  ".X.......X..",
  ".X....X..X..",
  ".X.X.X...X..",
  ".X..X....X..",
  "..X.....X...",
  "...XXXXX....",
] as const;

const WAREHOUSE = [
  ".....XX.....",
  "...XXXXXX...",
  ".XXXXXXXXXX.",
  "XX........XX",
  "XX.XX..XX.XX",
  "XX.XX..XX.XX",
  "XX........XX",
  "XX..XXXX..XX",
  "XX..XXXX..XX",
] as const;

const HOOK_CRATE = [
  ".....XX.....",
  ".....X......",
  "....XXX.....",
  "XXXXXXXXXXX.",
  "X.........X.",
  "X..XXXXX..X.",
  "X.........X.",
  "XXXXXXXXXXX.",
] as const;

const CLOCK = [
  "...XXXXXX...",
  ".XX......XX.",
  ".X........X.",
  "X.....X....X",
  "X.....X....X",
  "X....XX....X",
  ".X........X.",
  ".XX......XX.",
  "...XXXXXX...",
] as const;

function DotIcon({ rows }: { rows: readonly string[] }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows.length}`}
      className="h-12 w-auto lg:h-14"
      aria-hidden="true"
      focusable="false"
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "X" ? (
            <circle
              key={`${x}-${y}`}
              cx={x + 0.5}
              cy={y + 0.5}
              r={0.34}
              fill="currentColor"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

const SERVICES = [
  {
    title: ["Air", "Freight"],
    icon: PLANE,
    copy: "Time-critical uplift on scheduled and charter capacity, planned to the hour across forty APAC lanes.",
  },
  {
    title: ["Ocean", "Freight"],
    icon: SHIP,
    copy: "FCL, LCL and reefer programmes, with carrier selection engineered for cost, transit and reliability.",
  },
  {
    title: ["Customs", "Brokerage"],
    icon: STAMP,
    copy: "Licensed in-house entry, classification and compliance — filed before the vessel berths, never outsourced.",
  },
  {
    title: ["Warehousing", "and 3PL"],
    icon: WAREHOUSE,
    copy: "Bonded and ambient space across nine ports — pick, pack and cross-dock, billed by the pallet-day.",
  },
  {
    title: ["Project", "Cargo"],
    icon: HOOK_CRATE,
    copy: "Out-of-gauge and heavy-lift moves engineered from route survey to set-down.",
  },
  {
    title: ["Domestic &", "Interstate"],
    icon: CLOCK,
    copy: "Metro and linehaul transport on one telematics feed, with a live ETA on every leg.",
  },
] as const;

export default function FollowStrip({ ghostRef, stripRef }: FollowStripProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {/* The ghost wordmark: bottom-set on the paper band, so its baseline
          rides just above the seam. The vehicle layer draws over it. */}
      <div
        ref={ghostRef}
        className="absolute top-0 left-0 flex items-end will-change-transform"
        style={{ height: pct(DRIVE.ground) }}
      >
        <span className="u-display pb-[1.5svh] leading-[0.78] whitespace-nowrap text-ink/[0.05] uppercase text-[min(34svh,26vw)]">
          Our services
        </span>
      </div>

      {/* The card strip: one flex row the width of its content, laid on the
          night band. Widths are stated in viewport units so the whole strip
          spans a known multiple of the screen at any size. */}
      <div
        ref={stripRef}
        className="absolute left-0 flex w-max items-stretch text-paper will-change-transform"
        style={{ top: pct(DRIVE.ground), height: pct(1 - DRIVE.ground) }}
      >
        {/* The strip's masthead: rides past first, before the cards. */}
        <div
          data-strip-panel
          className="flex w-[88vw] shrink-0 flex-col justify-center gap-10 pr-[6vw] pb-[6svh] pl-[9vw] lg:flex-row lg:items-center lg:justify-between lg:gap-16"
        >
          <p className="u-display shrink-0 text-[clamp(2.2rem,4.9vw,4.9rem)] leading-[0.95] whitespace-nowrap">
            <span className="block">Everything your</span>
            <span className="block">freight needs.</span>
            <span className="block text-paper/30">Under one operator.</span>
          </p>
          <div className="max-w-sm space-y-4 text-sm leading-relaxed text-paper/60 sm:text-base">
            <p>
              From the first uplift to the final kilometre — air, ocean, customs
              and distribution planned as one movement.
            </p>
            <p>
              One contract, one control tower, and live visibility on every leg
              between gate and dock.
            </p>
          </div>
        </div>

        {SERVICES.map((service) => (
          <article
            key={service.title.join(" ")}
            data-strip-panel
            className="relative w-[24vw] min-w-[300px] shrink-0 px-[2.2vw] pt-[9svh]"
          >
            {/* The reference's short divider: icon-to-copy, not full height. */}
            <span className="absolute top-[9svh] bottom-[16svh] left-0 w-px bg-paper/12" />
            <span data-strip-accent className="block text-paper">
              <DotIcon rows={service.icon} />
            </span>
            <h3 className="font-display mt-[4.5svh] text-xl leading-tight font-bold tracking-tight uppercase sm:text-2xl">
              <span className="block">{service.title[0]}</span>
              <span className="block">{service.title[1]}</span>
            </h3>
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-paper/55">
              {service.copy}
            </p>
          </article>
        ))}

        {/* Tail air, so the last card is not glued to the run's end frame. */}
        <div className="w-[8vw] shrink-0" />
      </div>
    </div>
  );
}
