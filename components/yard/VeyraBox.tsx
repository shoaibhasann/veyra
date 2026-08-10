/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties, RefObject } from "react";
import { SPRITE, pct } from "./geometry";

/**
 * The VEYRA 40ft box. The wrapper IS the steel: the source is blown up and
 * offset so its measured content box exactly fills the wrapper, and the
 * transparent margin is clipped away. The constraint functions treat the
 * wrapper as a rigid body — the roof contact plane, the casting underside and
 * the casting centres all live at fixed fractions inside it (see geometry.ts).
 *
 * One livery only, and it is the brand's: no tint pass, the render carries its
 * own VYRU 040044 45G1 markings.
 */

const BOX = SPRITE.box.box;

export interface VeyraBoxProps {
  boxRef?: RefObject<HTMLDivElement | null>;
  style?: CSSProperties;
  className?: string;
}

export default function VeyraBox({ boxRef, style, className }: VeyraBoxProps) {
  return (
    <div
      ref={boxRef}
      className={`absolute top-0 left-0 overflow-hidden ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    >
      <img
        src={SPRITE.box.src}
        alt=""
        decoding="async"
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: pct(1 / BOX.w),
          height: pct(1 / BOX.h),
          left: pct(-BOX.x / BOX.w),
          top: pct(-BOX.y / BOX.h),
        }}
      />
      {/* Hairline so a white box still has an edge on white paper. */}
      <span
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 0 1px rgba(17,17,17,0.12)" }}
      />
    </div>
  );
}
