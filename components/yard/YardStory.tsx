"use client";

import YardFrame from "./YardFrame";
import {
  BEAT,
  SPRITE,
  STATIC_P,
  TOP_BODY_CX,
  TOP_BODY_CY,
  TOP_BODY_W,
  TOP_DECK,
} from "./geometry";
import { CARRIAGEWAYS, LANE_LINES, ROAD, ROAD_WIDTH } from "./road";

/**
 * The yard, told as a sequence instead of a scrub.
 *
 * Phones, portrait tablets and anyone on `prefers-reduced-motion` cannot be
 * given a twelve-viewport pinned narrative — so they get the same story cut into
 * its key frames, each one composed with its own `scale` / `ground` pair rather
 * than a shrunken copy of the desktop stage. The frames are the SAME pose
 * functions the scrubbed rig runs on, so the machine, the box and the trailer
 * meet here exactly where they meet there.
 *
 * Which of the two ships is decided in CSS (`.yard-static` / `.yard-live`), not
 * here — see app/globals.css.
 */

/* ---------------------------------------------------------------- overhead -- */

/** Half way along the route: the middle of the bend, where the truck is turning. */
const TOP_POSE = ROAD.pointAt(ROAD.totalLength * 0.5);

const TOP_IMG_W = 1 / TOP_BODY_W;
const TOP_IMG_H = TOP_IMG_W * (SPRITE.truckTop.h / SPRITE.truckTop.w);
const TOP_PIVOT_X = TOP_BODY_CX * TOP_IMG_W;
const TOP_PIVOT_Y = TOP_BODY_CY * TOP_IMG_H;

/** Road units, framed 3:2 on the junction with every arm running off frame. */
const VIEW = { x: -2.5, y: -0.95, w: 5.6, h: 5.6 / 1.5 };

const ASPHALT = "#0A0A0B";

function TopDownFrame() {
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden bg-paper">
      {/* Drawn before the road, so the tarmac crosses the word. */}
      <p
        aria-hidden="true"
        className="u-display absolute bottom-[6%] left-[4%] text-[clamp(2.25rem,9vw,6rem)] leading-[0.84]"
      >
        Reliability,
        <br />
        routed.
      </p>

      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        className="absolute inset-0 block h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" strokeLinecap="butt">
          <g opacity={0.06}>
            {CARRIAGEWAYS.map((d) => (
              <path key={`edge-${d}`} d={d} stroke={ASPHALT} strokeWidth={ROAD_WIDTH + 0.08} />
            ))}
          </g>
          {CARRIAGEWAYS.map((d) => (
            <path key={d} d={d} stroke={ASPHALT} strokeWidth={ROAD_WIDTH} />
          ))}
          {LANE_LINES.map((d) => (
            <path
              key={`lane-${d}`}
              d={d}
              stroke="#ffffff"
              strokeOpacity={0.88}
              strokeWidth={0.022}
              strokeDasharray="0.34 0.3"
            />
          ))}
        </g>

        {/* Same composite the scrubbed rig runs: the EMPTY overhead trailer
            with the plan-view VEYRA box filling the measured deck rect, so the
            frozen story carries the same branded cargo. Filter lengths resolve
            in road units, so the halo scales with the frame. */}
        <g
          transform={
            `translate(${TOP_POSE.x.toFixed(4)} ${TOP_POSE.y.toFixed(4)}) ` +
            `rotate(${TOP_POSE.heading.toFixed(3)}) ` +
            `translate(${(-TOP_PIVOT_X).toFixed(4)} ${(-TOP_PIVOT_Y).toFixed(4)})`
          }
          style={{
            filter:
              "drop-shadow(0 0 0.01px rgba(255,255,255,0.85)) " +
              "drop-shadow(0 0.05px 0.07px rgba(10,10,11,0.5))",
          }}
        >
          <image href={SPRITE.truckTop.src} width={TOP_IMG_W} height={TOP_IMG_H} />
          <svg
            x={TOP_IMG_W * TOP_DECK.x}
            y={TOP_IMG_H * TOP_DECK.y}
            width={TOP_IMG_W * TOP_DECK.w}
            height={TOP_IMG_H * TOP_DECK.h}
            viewBox={
              `${SPRITE.containerTop.box.x * SPRITE.containerTop.w} ` +
              `${SPRITE.containerTop.box.y * SPRITE.containerTop.h} ` +
              `${SPRITE.containerTop.box.w * SPRITE.containerTop.w} ` +
              `${SPRITE.containerTop.box.h * SPRITE.containerTop.h}`
            }
            preserveAspectRatio="none"
          >
            <image
              href={SPRITE.containerTop.src}
              width={SPRITE.containerTop.w}
              height={SPRITE.containerTop.h}
            />
          </svg>
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------- copy -- */

interface BeatCopy {
  eyebrow: string;
  headline: string;
  label: string;
  copy: string;
}

function Copy({ eyebrow, headline, label, copy }: BeatCopy) {
  return (
    <div className="mt-7 lg:mt-0">
      <span className="font-mono text-[10px] tracking-[0.24em] text-ink/50 uppercase sm:text-[11px]">
        {eyebrow}
      </span>
      <h3 className="u-display mt-4 max-w-[14ch] text-[clamp(1.9rem,7vw,3.5rem)]">
        {headline}
      </h3>
      <div className="mt-6 border-t border-ink/15 pt-4">
        <span className="block font-mono text-[11px] tracking-[0.28em] text-signal uppercase">
          {label}
        </span>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70 sm:text-base">
          {copy}
        </p>
      </div>
    </div>
  );
}

const PICK: BeatCopy = {
  eyebrow: "01 — Terminal",
  headline: "Containers, handled.",
  label: "Lock on",
  copy: "The spreader finds the corner castings, takes the weight and swings the box clear of the stack. Nine seconds, every time.",
};

const PLACE: BeatCopy = {
  eyebrow: "02 — Chassis",
  headline: "Set down, first time.",
  label: "Placement",
  copy: "Twin-lock down onto a bare skeletal trailer, squared to the deck rails. No second pass, no repositioning move, no waiting driver on demurrage.",
};

const RUN: BeatCopy = {
  eyebrow: "04 — Network",
  headline: "Routed, not guessed.",
  label: "Live ETA",
  copy: "Telematics pushes a fresh arrival every ninety seconds, off the same feed your customer is watching. When the lane moves, the plan moves with it.",
};

/* ------------------------------------------------------------------ story -- */

export default function YardStory() {
  return (
    <div className="yard-static bg-paper text-ink">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24">
        <article>
          <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            <YardFrame
              p={BEAT.pick}
              scale={1.4}
              ground={0.816}
              className="aspect-[3/2] w-full"
            />
            <Copy {...PICK} />
          </div>
        </article>

        <article className="mt-14 border-t border-ink/12 pt-14">
          <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            {/* Frozen just after placeTouch: castings on the deck, twistlocks
                still seated, boom down at the solved placement angle. */}
            <YardFrame
              p={0.552}
              scale={1.41}
              ground={0.771}
              shiftX={0.01}
              className="aspect-[3/2] w-full"
            />
            <Copy {...PLACE} />
          </div>
        </article>

        {/* The driving beat. Paper above, night below, the truck on the join —
            the seam IS the frame's ground line, so the tyres sit on it by
            construction at either aspect. */}
        <article className="relative mt-14 -mx-5 sm:-mx-8">
          <YardFrame
            p={STATIC_P}
            scale={1.5}
            ground={0.53}
            className="aspect-[4/5] w-full sm:aspect-[3/2]"
            style={{
              background:
                "linear-gradient(to bottom, var(--color-paper) 0 53%, var(--color-night) 53% 100%)",
            }}
          />

          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-7 sm:px-8 sm:pb-9">
            <span className="font-mono text-[10px] tracking-[0.24em] text-paper/50 uppercase sm:text-[11px]">
              03 — Land
            </span>
            <p className="u-display mt-3 text-[clamp(1.9rem,8vw,5rem)] text-paper">
              <span className="block">Every lane.</span>
              <span className="block">Every leg.</span>
            </p>
            <a
              href="#carriers"
              className="mt-6 self-start rounded-full border border-paper/30 px-6 py-3 font-mono text-[10px] tracking-[0.24em] text-paper uppercase transition-colors duration-300 hover:border-signal hover:bg-signal focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none sm:px-7 sm:text-[11px]"
            >
              Our services
            </a>
          </div>
        </article>

        <div className="mt-9 border-t border-ink/15 pt-4 lg:max-w-md">
          <span className="block font-mono text-[11px] tracking-[0.28em] text-signal uppercase">
            Linehaul
          </span>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70 sm:text-base">
            Weight set to axle limits, seal photographed at the gate, and one
            accountable operator from the terminal gate to the receiving dock.
          </p>
        </div>

        <article className="mt-14 border-t border-ink/12 pt-14">
          <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            <TopDownFrame />
            <Copy {...RUN} />
          </div>
        </article>

        <p className="u-display mt-16 text-center text-[clamp(2rem,8vw,5rem)]">
          Delivered. Every time.
        </p>
      </div>
    </div>
  );
}
