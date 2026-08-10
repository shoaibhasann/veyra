"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  CARRIAGEWAYS,
  CHEVRONS,
  JUNCTION,
  LANE_LINES,
  ROAD,
  ROAD_WIDTH,
  registerTravelPath,
  roadUnitPx,
  setRoadFrame,
} from "./road";

export interface RoadPathProps {
  /** Camera hook on the outer group. Left identity by default. */
  groupRef: RefObject<SVGGElement | null>;
  /** Optional handle on the display type, so the copy band can hand over to it. */
  typeRef?: RefObject<HTMLParagraphElement | null>;
}

const ASPHALT = "#0A0A0B";
const PAINT = "#ffffff";

/**
 * The overhead junction: a carriageway in from the left, turning down and out
 * through the bottom, with a second arm carrying on to the right.
 *
 * Drawn in road units and placed by one group transform, so a stroke authored
 * as 0.022 is always 2.2% of a truck length at any viewport. No viewBox, which
 * makes one user unit one CSS pixel before that transform — the fit is then the
 * only thing recomputed on resize, and it is the same number `sampleTravel`
 * uses to turn path points into stage pixels.
 */
export default function RoadPath({ groupRef, typeRef }: RoadPathProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<SVGGElement>(null);
  const travelRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    registerTravelPath(travelRef.current);

    const fit = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const s = roadUnitPx(w, h);
      const x = JUNCTION.x * w;
      const y = JUNCTION.y * h;
      setRoadFrame(s, x, y);
      fitRef.current?.setAttribute(
        "transform",
        `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(4)})`,
      );
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);

    return () => {
      observer.disconnect();
      registerTravelPath(null);
    };
  }, []);

  return (
    <div ref={boxRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* The route copy moved to RouteContent — the left headline and the
          right-hand cards that swap as the truck runs south. typeRef remains
          the ticker's handle on that headline, passed through by the parent. */}

      <svg width="100%" height="100%" className="absolute inset-0 block">
        <g ref={groupRef}>
          <g ref={fitRef} fill="none" strokeLinecap="butt">
            {/* One group opacity, so the three overlapping arms union into a
                single soft edge instead of stacking into a grey halo. */}
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
                stroke={PAINT}
                strokeOpacity={0.88}
                strokeWidth={0.022}
                strokeDasharray="0.34 0.3"
              />
            ))}

            {/* The merge island: hatched chevrons pointing back into the
                join, like the reference's painted wedge. */}
            <g opacity={0.3}>
              {CHEVRONS.map((d) => (
                <path key={`chev-${d}`} d={d} stroke={PAINT} strokeWidth={0.028} />
              ))}
            </g>

            {/* Not drawn — sampled. The vehicle's position and its heading both
                come off this one element, so they cannot disagree. */}
            <path ref={travelRef} d={ROAD.d} stroke="none" />
          </g>
        </g>
      </svg>
    </div>
  );
}
