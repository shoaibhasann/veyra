"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

type Frame = ImageBitmap | HTMLImageElement;

export interface UseFrameSequenceOptions {
  /** Folder the frames live in, e.g. "/frames/crane". */
  basePath: string;
  /** How many frames the sequence has. */
  count: number;
  ext?: string;
  pad?: number;
  /** ScrollTrigger start, only used while scrubbing. */
  start?: string;
  /** ScrollTrigger end, only used while scrubbing. */
  end?: string;
  pin?: boolean;
  /**
   * Off means: no ScrollTrigger, no bulk preload — a single still frame is
   * fetched and painted. This is the mobile / reduced-motion path.
   */
  scrub?: boolean;
  /** Gate the effect until the caller has decided which mode to run in. */
  active?: boolean;
  /** Frame used when `scrub` is off. Defaults to the middle of the sequence. */
  stillFrame?: number;
}

export interface FrameSequenceHandle<T extends HTMLElement = HTMLDivElement> {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<T | null>;
  /** Live scroll progress of the sequence, 0–1. Read it in a ticker, not in render. */
  progressRef: RefObject<number>;
  /** Frames decoded so far. */
  loaded: number;
  /** Frames this hook intends to decode — `count` while scrubbing, 1 otherwise. */
  total: number;
  /** Enough frames are decoded for the canvas to look intentional. */
  ready: boolean;
}

const POOL_SIZE = 6;
const READY_FRAMES = 10;
const MAX_DPR = 2;

/**
 * A decoded ImageBitmap holds uncompressed RGBA forever, so a 170-frame
 * sequence at 1280x720 would pin ~630 MB. Past this budget we keep
 * HTMLImageElements instead and let the browser evict decoded data.
 */
const BITMAP_BUDGET_BYTES = 192 * 1024 * 1024;

function frameUrl(basePath: string, index: number, ext: string, pad: number): string {
  return `${basePath.replace(/\/+$/, "")}/frame_${String(index).padStart(pad, "0")}.${ext}`;
}

function frameSize(frame: Frame): [number, number] {
  return frame instanceof HTMLImageElement
    ? [frame.naturalWidth, frame.naturalHeight]
    : [frame.width, frame.height];
}

function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(
          () => resolve(img),
          () => resolve(img),
        );
      } else {
        resolve(img);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadBitmap(url: string, signal: AbortSignal): Promise<Frame | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    if (signal.aborted) return null;
    return loadImageElement(url);
  }
}

/**
 * Coarse-to-fine ordering: strides of 16, then 8, 4, 2, 1. The whole sequence
 * is roughly scrubbable after a handful of frames instead of only the head.
 */
function buildLoadOrder(count: number): number[] {
  const order: number[] = [];
  const seen = new Uint8Array(count);
  for (let stride = 16; stride >= 1; stride = stride >> 1) {
    for (let i = 0; i < count; i += stride) {
      if (!seen[i]) {
        seen[i] = 1;
        order.push(i);
      }
    }
  }
  for (let i = 0; i < count; i++) {
    if (!seen[i]) order.push(i);
  }
  return order;
}

async function runPool(
  order: number[],
  limit: number,
  worker: (index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const drain = async (): Promise<void> => {
    while (cursor < order.length) {
      await worker(order[cursor++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, order.length) }, drain));
}

export function useFrameSequence<T extends HTMLElement = HTMLDivElement>({
  basePath,
  count,
  ext = "webp",
  pad = 3,
  start = "top top",
  end = "+=200%",
  pin = true,
  scrub = true,
  active = true,
  stillFrame,
}: UseFrameSequenceOptions): FrameSequenceHandle<T> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<T>(null);
  const progressRef = useRef<number>(0);

  const [loaded, setLoaded] = useState(0);

  const total = scrub ? count : 1;

  useEffect(() => {
    if (!active || count < 1) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = Math.min(
      count - 1,
      Math.max(0, stillFrame ?? Math.floor((count - 1) / 2)),
    );

    const frames: (Frame | null)[] = new Array(count).fill(null);
    const controller = new AbortController();
    let disposed = false;
    let lastDrawn = -1;
    let wanted = scrub ? 0 : still;

    progressRef.current = 0;
    setLoaded(0);

    // Coalesce the 170 load callbacks into at most one render per frame.
    let loadedCount = 0;
    let pendingReport = 0;
    const reportLoaded = () => {
      if (pendingReport) return;
      pendingReport = requestAnimationFrame(() => {
        pendingReport = 0;
        if (!disposed) setLoaded(loadedCount);
      });
    };

    const nearestLoaded = (index: number): number => {
      if (frames[index]) return index;
      for (let d = 1; d < count; d++) {
        if (index - d >= 0 && frames[index - d]) return index - d;
        if (index + d < count && frames[index + d]) return index + d;
      }
      return -1;
    };

    const paint = (frame: Frame) => {
      const cw = canvas.width;
      const ch = canvas.height;
      const [iw, ih] = frameSize(frame);
      if (!iw || !ih || !cw || !ch) return;

      // object-fit: cover — fill the box, crop the overflow, never letterbox.
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(frame, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const draw = (index: number) => {
      wanted = index;
      const target = nearestLoaded(index);
      if (target < 0 || target === lastDrawn) return;
      const frame = frames[target];
      if (!frame) return;
      lastDrawn = target;
      paint(frame);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      lastDrawn = -1; // resizing clears the backing store
      draw(wanted);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const commit = (index: number, frame: Frame | null) => {
      if (disposed) {
        if (frame && !(frame instanceof HTMLImageElement)) frame.close();
        return;
      }
      if (!frame) return;
      frames[index] = frame;
      loadedCount++;
      reportLoaded();
      draw(wanted);
    };

    const load = async () => {
      // Frame 0 comes down as a plain <img> so we can size the sequence before
      // committing to a decode strategy, and paint something immediately.
      const first = scrub ? 0 : still;
      const head = await loadImageElement(frameUrl(basePath, first, ext, pad));
      if (disposed) return;
      commit(first, head);

      if (!scrub || count < 2) return;

      const [iw, ih] = head ? frameSize(head) : [1920, 1080];
      const useBitmaps =
        typeof createImageBitmap === "function" &&
        count * iw * ih * 4 <= BITMAP_BUDGET_BYTES;

      const order = buildLoadOrder(count).filter((i) => i !== first);
      await runPool(order, POOL_SIZE, async (index) => {
        if (disposed) return;
        const url = frameUrl(basePath, index, ext, pad);
        const frame = useBitmaps
          ? await loadBitmap(url, controller.signal)
          : await loadImageElement(url);
        commit(index, frame);
      });
    };

    void load();

    let trigger: ScrollTrigger | null = null;
    let tween: gsap.core.Tween | null = null;

    if (scrub && count > 1) {
      const state = { f: 0 };
      tween = gsap.to(state, {
        f: count - 1,
        ease: "none",
        snap: { f: 1 },
        paused: true,
        onUpdate: () => draw(Math.round(state.f)),
      });

      trigger = ScrollTrigger.create({
        trigger: container,
        start,
        end,
        pin: pin ? container : false,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        animation: tween,
        onUpdate: (self) => {
          progressRef.current = self.progress;
        },
      });
    }

    return () => {
      disposed = true;
      if (pendingReport) cancelAnimationFrame(pendingReport);
      controller.abort();
      observer.disconnect();
      trigger?.kill();
      tween?.kill();
      for (const frame of frames) {
        if (frame && !(frame instanceof HTMLImageElement)) frame.close();
      }
      frames.length = 0;
    };
  }, [active, basePath, count, ext, pad, start, end, pin, scrub, stillFrame]);

  return {
    canvasRef,
    containerRef,
    progressRef,
    loaded,
    total,
    ready: loaded >= Math.min(READY_FRAMES, total),
  };
}

export default useFrameSequence;
