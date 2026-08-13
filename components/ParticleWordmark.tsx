"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * THE WORDMARK, AS WEATHER. The footer's dot-screen VEYRA rebuilt as a
 * particle system: the glyphs are sampled off an offscreen canvas into a
 * few thousand dots, each with a HOME. The pointer repels whatever it
 * touches; a spring pulls every dot back; friction decides how long the
 * cloud hangs in the air. Scatter and reassembly are the same three
 * forces — there is no "reassemble animation", only physics settling.
 *
 * Written for the frame budget:
 *  - typed arrays, squares not arcs, one path per frame
 *  - physics in logical px; DPR lives in a single setTransform
 *  - a settled flag: once every dot is home and the pointer is gone, the
 *    loop stops drawing entirely until the next touch
 *  - offscreen sampling repeats on resize and only after the webfont, so
 *    the dots trace Archivo, not a fallback
 *
 * Reduced motion: one static draw, no listeners, no ticker.
 */
interface Props {
  text?: string;
  className?: string;
}

/** Logical px between sampled dots — the dot pitch of the old CSS screen. */
const PITCH = 6;
/** Hard ceiling on dots; the pitch widens on huge screens to respect it. */
const MAX_DOTS = 9000;
/** Pointer influence radius, logical px. */
const RADIUS = 135;
/** Shove strength at the pointer's centre. */
const POWER = 2.7;
/** How much of the pointer's own sweep velocity the dust inherits. */
const THROW = 0.16;
/** Per-particle ranges — the whole point. Identical constants push every
    dot along the same radial line and they pool on the radius in a rigid
    dome; giving each dot its own deflection angle (up to ~±52°), its own
    force, spring and friction is what turns the ring into dust — different
    directions, different distances, different return times. */
const JITTER = 0.9;
const FORCE_MIN = 0.4;
const FORCE_MAX = 1.7;
const SPRING_MIN = 0.028;
const SPRING_MAX = 0.075;
const FRICTION_MIN = 0.862;
const FRICTION_MAX = 0.916;
/** Terminal velocity, so a lucky dot cannot leave the county. */
const VMAX = 26;
/** The ink — matches the darkened dot screen it replaces. */
const COLOR = "rgba(17, 17, 17, 0.5)";

export default function ParticleWordmark({ text = "VEYRA", className = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = prefersReducedMotion();

    // px,py,hx,hy,vx,vy,cosA,sinA,force,spring,friction per dot, packed.
    const STRIDE = 11;
    let dots = new Float32Array(0);
    let count = 0;
    let w = 0;
    let h = 0;
    const m = { x: -1e5, y: -1e5, vx: 0, vy: 0, active: false };
    let settled = false;
    let onScreen = true;
    let cancelled = false;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = COLOR;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        ctx.rect(dots[o] - 0.8, dots[o + 1] - 0.8, 1.6, 1.6);
      }
      ctx.fill();
    };

    const build = () => {
      w = wrap.clientWidth;
      if (!w) return;
      // The old CSS type: text-[min(23vw,320px)] with tight leading.
      const fontPx = Math.min(0.23 * w, 320);
      h = Math.ceil(fontPx * 0.94);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Trace the glyphs offscreen, in the site's own display face.
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d");
      if (!octx) return;
      const family = getComputedStyle(wrap).fontFamily;
      octx.font = `800 ${fontPx}px ${family}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#000";
      octx.fillText(text.toUpperCase(), w / 2, h / 2 + fontPx * 0.04);
      const img = octx.getImageData(0, 0, w, h).data;

      // Sample on a grid; widen the pitch until the ceiling holds.
      let step = PITCH;
      const countAt = (s: number) => {
        let n = 0;
        for (let y = 0; y < h; y += s)
          for (let x = 0; x < w; x += s) if (img[(y * w + x) * 4 + 3] > 128) n++;
        return n;
      };
      while (countAt(step) > MAX_DOTS) step++;

      const pts: number[] = [];
      for (let y = 0; y < h; y += step)
        for (let x = 0; x < w; x += step)
          if (img[(y * w + x) * 4 + 3] > 128) pts.push(x, y);

      count = pts.length / 2;
      dots = new Float32Array(count * STRIDE);
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        dots[o] = dots[o + 2] = pts[i * 2];
        dots[o + 1] = dots[o + 3] = pts[i * 2 + 1];
        // This dot's own character, fixed for its lifetime.
        const a = (Math.random() * 2 - 1) * JITTER;
        dots[o + 6] = Math.cos(a);
        dots[o + 7] = Math.sin(a);
        dots[o + 8] = FORCE_MIN + Math.random() * (FORCE_MAX - FORCE_MIN);
        dots[o + 9] = SPRING_MIN + Math.random() * (SPRING_MAX - SPRING_MIN);
        dots[o + 10] = FRICTION_MIN + Math.random() * (FRICTION_MAX - FRICTION_MIN);
      }
      settled = false;
      draw();
      if (reduce) settled = true;
    };

    const tick = () => {
      if (settled || !onScreen || !count) return;
      const r2 = RADIUS * RADIUS;
      let energy = 0;
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        let vx = dots[o + 4];
        let vy = dots[o + 5];
        if (m.active) {
          const dx = dots[o] - m.x;
          const dy = dots[o + 1] - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const q = 1 - d / RADIUS;
            // Eased toward the centre, scaled by THIS dot's force —
            // and deflected through its own fixed angle, so the crowd
            // leaves along thousands of different lines, not one.
            const f = q * q * POWER * dots[o + 8];
            const ux = dx / d;
            const uy = dy / d;
            vx += (ux * dots[o + 6] - uy * dots[o + 7]) * f;
            vy += (ux * dots[o + 7] + uy * dots[o + 6]) * f;
            // The throw: dust picks up the sweep itself.
            vx += m.vx * THROW * dots[o + 8] * q;
            vy += m.vy * THROW * dots[o + 8] * q;
            // A pinch of shimmer while disturbed, gated to the disturbed.
            vx += (Math.random() - 0.5) * 0.5 * q;
            vy += (Math.random() - 0.5) * 0.5 * q;
          }
        }
        const k = dots[o + 9];
        const fr = dots[o + 10];
        vx = (vx + (dots[o + 2] - dots[o]) * k) * fr;
        vy = (vy + (dots[o + 3] - dots[o + 1]) * k) * fr;
        if (vx > VMAX) vx = VMAX;
        else if (vx < -VMAX) vx = -VMAX;
        if (vy > VMAX) vy = VMAX;
        else if (vy < -VMAX) vy = -VMAX;
        dots[o] += vx;
        dots[o + 1] += vy;
        dots[o + 4] = vx;
        dots[o + 5] = vy;
        energy += vx * vx + vy * vy;
      }
      // The throw fades once thrown.
      m.vx *= 0.8;
      m.vy *= 0.8;
      draw();
      // Everyone home, nobody moving, nobody pushing: stop burning frames.
      if (!m.active && energy < count * 0.0004) {
        for (let i = 0; i < count; i++) {
          const o = i * STRIDE;
          dots[o] = dots[o + 2];
          dots[o + 1] = dots[o + 3];
          dots[o + 4] = 0;
          dots[o + 5] = 0;
        }
        draw();
        settled = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;
      if (m.active) {
        // The sweep: how hard the hand is moving. The dust inherits it.
        m.vx = Math.max(-40, Math.min(40, nx - m.x));
        m.vy = Math.max(-40, Math.min(40, ny - m.y));
      }
      m.x = nx;
      m.y = ny;
      m.active = true;
      settled = false;
    };
    const onLeave = () => {
      m.active = false;
      m.vx = 0;
      m.vy = 0;
      settled = false;
    };

    // Only tick while the footer is actually on screen.
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    io.observe(wrap);

    // Debounced through a TIMER, not rAF: rAF starves in a background or
    // occluded tab, and the one resize that matters most — the pane getting
    // its width back — is exactly the one that would be dropped.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(raf);
      raf = window.setTimeout(build, 120);
    });

    const start = () => {
      if (cancelled) return;
      build();
      ro.observe(wrap);
      if (reduce) return;
      wrap.addEventListener("pointermove", onMove, { passive: true });
      wrap.addEventListener("pointerdown", onMove, { passive: true });
      wrap.addEventListener("pointerleave", onLeave);
      gsap.ticker.add(tick);
    };

    // The dots trace the webfont or they trace nothing.
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(start).catch(start);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      io.disconnect();
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      gsap.ticker.remove(tick);
    };
  }, [text]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`font-display relative w-full overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="block w-full select-none" />
    </div>
  );
}
