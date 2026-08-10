"use client";

import { useEffect, useState } from "react";
import { useFrameSequence } from "@/hooks/useFrameSequence";

export interface FrameSequenceProps {
  /** Folder holding the stills, e.g. "/frames/crane". */
  basePath: string;
  count: number;
  ext?: string;
  pad?: number;
  /** Intrinsic size of a source frame — drives the still-mode aspect ratio. */
  width: number;
  height: number;
  start?: string;
  end?: string;
  pin?: boolean;
  className?: string;
  /** Overlay content, rendered above the canvas. */
  children?: React.ReactNode;
  /** Escape hatch for a background the canvas fades in over. Prefer `className`. */
  background?: string;
  /** Accessible description of the footage. Applied to the canvas, not the overlay. */
  label?: string;
  /** Frame shown in still mode. Defaults to the middle of the sequence. */
  stillFrame?: number;
}

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export default function FrameSequence({
  basePath,
  count,
  ext = "webp",
  pad = 3,
  width,
  height,
  start = "top top",
  end = "+=200%",
  pin = true,
  className,
  children,
  background,
  label,
  stillFrame,
}: FrameSequenceProps) {
  // null until the client has measured — keeps SSR and first hydration identical.
  const [scrub, setScrub] = useState<boolean | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 768px)");
    const sync = () => setScrub(!reduce.matches && !small.matches);

    sync();
    reduce.addEventListener("change", sync);
    small.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      small.removeEventListener("change", sync);
    };
  }, []);

  const scrubbing = scrub === true;

  const { canvasRef, containerRef, loaded, total, ready } = useFrameSequence({
    basePath,
    count,
    ext,
    pad,
    start,
    end,
    pin: pin && scrubbing,
    scrub: scrubbing,
    active: scrub !== null,
    stillFrame,
  });

  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className={cx("relative w-full overflow-hidden", scrubbing && "h-[100svh]", className)}
      style={{
        background,
        // Still mode has no pin, so the box follows the source ratio instead of
        // over-cropping a wide frame into a tall phone viewport.
        aspectRatio: scrubbing ? undefined : `${width} / ${height}`,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cx(
          "absolute inset-0 block h-full w-full transition-opacity duration-500",
          ready ? "opacity-100" : "opacity-0",
        )}
      />

      {/* currentColor keeps this legible on both the paper and night sections. */}
      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center gap-3",
          "text-current transition-opacity duration-500",
          ready ? "opacity-0" : "opacity-100",
        )}
      >
        <span className="font-mono text-[10px] tracking-[0.35em] uppercase opacity-40">
          Loading
        </span>
        <span className="relative block h-px w-40">
          <span className="absolute inset-0 bg-current opacity-15" />
          <span
            className="absolute inset-y-0 left-0 bg-current opacity-70 transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>

      {children ? <div className="absolute inset-0 z-10">{children}</div> : null}
    </div>
  );
}
