/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";
import { SPREADER_W, SPRITE, pct } from "./geometry";

export interface SpreaderRigProps {
  /** Carries the per-frame `translate3d(...)` of the spreader canvas corner. */
  spreaderRef: RefObject<HTMLDivElement | null>;
  /** The hoist line: translated to the boom head, scaleY'd to the pay-out. */
  cableRef: RefObject<HTMLSpanElement | null>;
}

/**
 * The hazard-striped beam, always horizontal. It is positioned in WORLD space
 * — its topHang lug rides the boom head computed in the same frame, plus the
 * cable's vertical drop — rather than nested under the crane, because it must
 * draw ABOVE the carried container while the boom draws below it.
 *
 * The cable is a 2px line hung from the head. Its length IS spreaderDrop(p):
 * the element spans the world's full height and is scaleY'd by the drop
 * fraction, so the ticker writes one transform and no layout ever runs.
 */
export default function SpreaderRig({ spreaderRef, cableRef }: SpreaderRigProps) {
  return (
    <>
      <span
        ref={cableRef}
        aria-hidden="true"
        className="absolute top-0 left-0 z-[11] block origin-top opacity-0 will-change-transform"
        style={{ width: 2, height: "100%", background: "rgba(17,17,17,0.58)" }}
      />

      <div
        ref={spreaderRef}
        aria-hidden="true"
        className="absolute top-0 left-0 z-[12] will-change-transform"
        style={{ width: pct(SPREADER_W) }}
      >
        <img
          src={SPRITE.spreader.src}
          alt=""
          width={SPRITE.spreader.w}
          height={SPRITE.spreader.h}
          decoding="async"
          draggable={false}
          className="block h-auto w-full select-none"
        />
      </div>
    </>
  );
}
