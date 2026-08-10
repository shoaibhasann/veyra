/* eslint-disable @next/next/no-img-element */
"use client";

import type { RefObject } from "react";
import { SPRITE, TOP_DECK, TOP_ORIGIN } from "./geometry";

export interface TruckTopRigProps {
  /** Carries the per-frame `translate(...) rotate(...)` the ticker owns. */
  wrapRef: RefObject<HTMLDivElement | null>;
  /**
   * The base vehicle image alone — NOT the container overlay. At the sea
   * handoff the ticker clips the cab away in sprite space, leaving just the
   * trailer under its box: the cargo appears to change vehicles, which is
   * the whole cut.
   */
  tractorRef: RefObject<HTMLImageElement | null>;
}

const CT = SPRITE.containerTop.box;

/**
 * The overhead vehicle: the EMPTY overhead trailer with the plan-view VEYRA
 * box composited onto the measured deck rect, so the box that rides out of
 * the yard is the same white branded unit the crane placed.
 *
 * Anchored at 0,0 and moved entirely by transform, with the origin on the
 * measured centre of the content box — the point the tilt's stand-up pivots
 * about and the point the road run will steer. Sized in viewport units: the
 * tilt frames the loaded rig at just under half the screen's width, like the
 * reference's final overhead frame.
 */
export default function TruckTopRig({ wrapRef, tractorRef }: TruckTopRigProps) {
  return (
    <div
      ref={wrapRef}
      className="absolute top-0 left-0 w-[53vw] will-change-transform"
      style={{ transformOrigin: TOP_ORIGIN }}
      aria-hidden="true"
    >
      {/* The filter sits on the composite, so the light halo and the cast
          shadow wrap trailer AND box as one silhouette. No warm pass any more:
          the cargo is the white VEYRA unit, and it should stay white. */}
      <div
        className="relative"
        style={{
          filter:
            "drop-shadow(0 0 2px rgba(255,255,255,0.45)) drop-shadow(0 7px 9px rgba(10,10,11,0.42))",
        }}
      >
        <img
          ref={tractorRef}
          src={SPRITE.truckTop.src}
          alt=""
          width={SPRITE.truckTop.w}
          height={SPRITE.truckTop.h}
          decoding="async"
          draggable={false}
          className="block h-auto w-full select-none"
        />

        {/* Deck rect from manifest truckEmptyTop.deck; the box's content crop
            fills it edge to edge, the same fit the loaded reference render
            carried. */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: `${(TOP_DECK.x * 100).toFixed(4)}%`,
            top: `${(TOP_DECK.y * 100).toFixed(4)}%`,
            width: `${(TOP_DECK.w * 100).toFixed(4)}%`,
            height: `${(TOP_DECK.h * 100).toFixed(4)}%`,
          }}
        >
          <img
            src={SPRITE.containerTop.src}
            alt=""
            decoding="async"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: `${((1 / CT.w) * 100).toFixed(4)}%`,
              height: `${((1 / CT.h) * 100).toFixed(4)}%`,
              left: `${((-CT.x / CT.w) * 100).toFixed(4)}%`,
              top: `${((-CT.y / CT.h) * 100).toFixed(4)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
