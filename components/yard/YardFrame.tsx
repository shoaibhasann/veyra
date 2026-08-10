/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties } from "react";
import DoorStack from "./DoorStack";
import VeyraBox from "./VeyraBox";
import {
  BOOM_MOUNT,
  BOOM_ORIGIN,
  BOX_H,
  BOX_W,
  CRANE_BODY_W,
  CRANE_SHADOW,
  GROUND,
  LAYER,
  SPREADER_W,
  SPRITE,
  TRUCK_SHADOW,
  TRUCK_W,
  WORLD,
  boomHeadPose,
  boomRotationAt,
  cableAlphaAt,
  cableDropAt,
  containerPose,
  containerShadow,
  cranePose,
  pct,
  spreaderPose,
  truckPose,
} from "./geometry";

const BOX_SHADOW_W = BOX_W * 1.16;

export interface YardFrameProps {
  /** Timeline position to freeze. Same 0..1 the scrubbed rig runs on. */
  p: number;
  /** World box width, as a fraction of the frame's own width. */
  scale: number;
  /** Where the truck's ground line lands, as a fraction of the frame's height. */
  ground: number;
  /** Lateral nudge in world-width fractions, to centre this beat's own group. */
  shiftX?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * One beat of the yard, frozen and laid out in percentages only — no ticker, no
 * measurement, no effect. Every element is placed by the SAME pose functions the
 * scrubbed rig calls — body, boom angle, hanging spreader, welded box — so the
 * kinematic chain and the measured contacts hold here too; the difference is
 * that a static frame needs no per-frame transform, so the poses resolve
 * straight into `left` / `top`, and the boom's rotation is one inline style.
 */
export default function YardFrame({
  p,
  scale,
  ground,
  shiftX = 0,
  className,
  style,
}: YardFrameProps) {
  const crane = cranePose(p);
  const truck = truckPose(p);
  const box = containerPose(p);
  const shadow = containerShadow(p);
  const sp = spreaderPose(p);
  const head = boomHeadPose(p);
  const drop = cableDropAt(p);
  const cableAlpha = cableAlphaAt(p);

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2"
        style={{
          width: `${(scale * 100).toFixed(4)}%`,
          top: pct(ground),
          aspectRatio: `${WORLD.w} / ${WORLD.h}`,
          transform: `translate(calc(-50% + ${(shiftX * 100).toFixed(4)}%), ${(
            -GROUND.truck * 100
          ).toFixed(4)}%)`,
        }}
      >
        <span
          className="absolute"
          style={{
            left: "-30%",
            width: "160%",
            top: pct(GROUND.truck),
            height: 1,
            background:
              "linear-gradient(90deg, rgba(17,17,17,0) 0%, rgba(17,17,17,0.16) 20%, rgba(17,17,17,0.16) 80%, rgba(17,17,17,0) 100%)",
          }}
        />

        <DoorStack />

        <span
          className="absolute origin-center"
          style={{
            left: pct(shadow.x - BOX_SHADOW_W / 2),
            top: pct(shadow.y - 0.011),
            width: pct(BOX_SHADOW_W),
            height: pct(0.022),
            opacity: shadow.opacity,
            transform: `scale(${shadow.scale.toFixed(3)})`,
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.3) 0%, rgba(17,17,17,0.12) 46%, rgba(17,17,17,0) 74%)",
          }}
        />

        <div
          className="absolute"
          style={{
            left: pct(truck.x),
            top: pct(truck.y),
            width: pct(TRUCK_W),
            zIndex: LAYER.truck,
          }}
        >
          <span
            className="absolute block"
            style={{
              left: pct(TRUCK_SHADOW.left),
              width: pct(TRUCK_SHADOW.width),
              top: pct(TRUCK_SHADOW.top),
              height: pct(TRUCK_SHADOW.height),
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.28) 0%, rgba(17,17,17,0.11) 46%, rgba(17,17,17,0) 74%)",
            }}
          />
          {/* The base render carries its own tyres; the rotatable overlays only
              exist on the scrubbed rig, and at rest they are identical. */}
          <img
            src={SPRITE.truck.src}
            alt=""
            width={SPRITE.truck.w}
            height={SPRITE.truck.h}
            decoding="async"
            draggable={false}
            className="relative block h-auto w-full select-none"
          />
        </div>

        {/* The machine, same chain as the live rig: chassis at cranePose, boom
            rotated about the welded pivot, spreader hung from the head. The
            chassis render carries its own tyres, so no overlays here either. */}
        <div className="absolute inset-0" style={{ zIndex: LAYER.crane }}>
          <span
            className="absolute origin-center"
            style={{
              left: pct(crane.x + CRANE_SHADOW.cx - CRANE_SHADOW.width / 2),
              top: pct(GROUND.crane - 0.013),
              width: pct(CRANE_SHADOW.width),
              height: pct(0.026),
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.34) 0%, rgba(17,17,17,0.13) 44%, rgba(17,17,17,0) 72%)",
            }}
          />
          <div
            className="absolute"
            style={{ left: pct(crane.x), top: pct(crane.y), width: pct(CRANE_BODY_W) }}
          >
            <div
              className="absolute"
              style={{
                left: pct(BOOM_MOUNT.left),
                top: pct(BOOM_MOUNT.top),
                width: pct(BOOM_MOUNT.width),
                transformOrigin: BOOM_ORIGIN,
                transform: `rotate(${boomRotationAt(p).toFixed(3)}deg)`,
              }}
            >
              <img
                src={SPRITE.craneBoom.src}
                alt=""
                width={SPRITE.craneBoom.w}
                height={SPRITE.craneBoom.h}
                decoding="async"
                draggable={false}
                className="block h-auto w-full select-none"
              />
            </div>
            <img
              src={SPRITE.craneBody.src}
              alt=""
              width={SPRITE.craneBody.w}
              height={SPRITE.craneBody.h}
              decoding="async"
              draggable={false}
              className="relative block h-auto w-full select-none"
            />
          </div>
        </div>

        <VeyraBox
          className="z-10"
          style={{
            left: pct(box.x),
            top: pct(box.y),
            width: pct(BOX_W),
            height: pct(BOX_H),
          }}
        />

        {cableAlpha > 0 && (
          <span
            className="absolute z-[11] block"
            style={{
              left: pct(head.x),
              top: pct(head.y),
              width: 2,
              marginLeft: -1,
              height: pct(drop),
              opacity: cableAlpha,
              background: "rgba(17,17,17,0.58)",
            }}
          />
        )}

        <div
          className="absolute z-[12]"
          style={{ left: pct(sp.x), top: pct(sp.y), width: pct(SPREADER_W) }}
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
      </div>
    </div>
  );
}
