/* eslint-disable @next/next/no-img-element */
"use client";

import { DOOR_SLOTS, LAYER, SPRITE, STACK_SHADOW, pct } from "./geometry";

const DOOR_SPRITES = {
  blue: SPRITE.doorBlue,
  orange: SPRITE.doorOrange,
} as const;

/**
 * The stack's bottom row: two 40ft door faces — navy and rust — standing side
 * by side on the stack lane, with the long white VEYRA box (the hero element,
 * animated by the section) lying across their top face until the pick.
 *
 * Static for the whole timeline, so it is laid out in percentages once and
 * never touched by the ticker. Each door is a content-box crop of its own
 * render: the two canvases differ in size and bake a soft right-hand drop
 * shadow, so the doors are normalised by CONTENT height (both equal one
 * container height) per the manifest note, never by image height.
 */
export default function DoorStack() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: LAYER.stack }}
      aria-hidden="true"
    >
      <span
        className="absolute"
        style={{
          left: pct(STACK_SHADOW.x),
          top: pct(STACK_SHADOW.y),
          width: pct(STACK_SHADOW.w),
          height: pct(STACK_SHADOW.h),
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(17,17,17,0.24) 0%, rgba(17,17,17,0.1) 48%, rgba(17,17,17,0) 76%)",
        }}
      />

      {DOOR_SLOTS.map((slot) => {
        const sprite = DOOR_SPRITES[slot.key];
        const box = sprite.box;
        return (
          <div
            key={slot.key}
            className="absolute overflow-hidden"
            style={{
              left: pct(slot.x),
              top: pct(slot.y),
              width: pct(slot.w),
              height: pct(slot.h),
            }}
          >
            <img
              src={sprite.src}
              alt=""
              decoding="async"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: pct(1 / box.w),
                height: pct(1 / box.h),
                left: pct(-box.x / box.w),
                top: pct(-box.y / box.h),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
