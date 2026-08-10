/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";
import { LADDER } from "./geometry";

export interface MorphRigProps {
  /** One handle per ladder frame, in LADDER order. The ticker owns opacity,
      width and transform — nothing here may declare them. */
  frameRefs: RefObject<HTMLImageElement | null>[];
}

/**
 * The tilt's angle ladder: the SAME vehicle pre-rendered at 15°, 40° and 65°
 * of camera elevation, mounted hidden and scrubbed through between the side
 * rig and the overhead rig. Each frame is anchored by its measured content
 * centre, so all five poses in the sequence pivot about one drifting point —
 * one truck, one camera move.
 */
export default function MorphRig({ frameRefs }: MorphRigProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {LADDER.map((frame, i) => (
        <img
          key={frame.src}
          ref={frameRefs[i]}
          src={frame.src}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute top-0 left-0 max-w-none opacity-0 select-none will-change-transform"
        />
      ))}
    </div>
  );
}
