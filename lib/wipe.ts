import { gsap } from "@/lib/gsap";
import { splitLines } from "@/lib/scramble";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * THE WIPE, as a behaviour.
 *
 * `.u-wipe` (globals.css) paints text through a gradient wider than the line
 * and slides it with the registered `--wipe` property; this splits an element
 * into LINES and runs that property 0 → 100 on each, staggered. Per line and
 * not per glyph on purpose: one gradient per line means ONE brand-coloured
 * edge travelling across the words, which is what reads as "revealing letter
 * by letter". A gradient per character would flash every glyph blue at once.
 *
 * The element keeps its own colour: `--wipe-final: currentColor`, so the same
 * call works on paper and on night without anyone passing a palette.
 */
export interface WipeOptions {
  /** Seconds one line takes. Omit to let the line's own width set it. */
  duration?: number;
  /** Seconds between consecutive lines. */
  stagger?: number;
  /** Seconds before the first line starts. */
  delay?: number;
  ease?: string;
  /** Brand colour on the leading edge; defaults to the CSS token. */
  edge?: string;
}


/**
 * How long one line should take. Fixed durations make short lines feel
 * rushed and long ones feel slow, because what the eye actually reads is
 * the EDGE'S SPEED across the glyphs. So the duration comes from the line's
 * measured width: the edge travels at a constant px/second everywhere on
 * the page, whatever the type size, and every word is uncovered at the same
 * unhurried pace.
 */
const EDGE_PX_PER_SEC = 400;
const MIN_S = 0.8;
const MAX_S = 1.9;

export function wipeDuration(el: HTMLElement): number {
  const w = el.getBoundingClientRect().width || 600;
  return Math.min(MAX_S, Math.max(MIN_S, w / EDGE_PX_PER_SEC));
}

/**
 * Where a line's wipe belongs. A rebuilt line is often a single authored
 * span — `<span class="block text-ink/35">…</span>` — and that span carries
 * its OWN colour. Painting the gradient on the wrapper would leave an opaque
 * child sitting on top of it (no reveal at all) and settle the line to the
 * parent's ink (the tone lost). Descend to the element that actually owns
 * the text, so the wipe adopts its colour instead of overriding it.
 */
function wipeHost(line: HTMLElement): HTMLElement {
  let host = line;
  for (;;) {
    const kids = [...host.childNodes];
    const els = kids.filter((n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE);
    const ownText = kids.some(
      (n) => n.nodeType === Node.TEXT_NODE && !!(n.nodeValue ?? "").trim(),
    );
    if (els.length !== 1 || ownText) return host;
    host = els[0];
  }
}

/**
 * Split `el` into wipe-ready line spans.
 *
 * Genuinely idempotent: if the element is ALREADY split into wipe lines it
 * reuses them instead of splitting again. Two owners can want the same
 * heading — the yard's chapter hand-off animates the lines rising while the
 * ticker drives their wipe — and a second split would swap the nodes out
 * from under whoever asked first, leaving their tween pointed at orphans.
 */
export function prepareWipe(
  el: HTMLElement,
  opts: { edge?: string; mask?: boolean } = {},
): HTMLElement[] {
  // Lines are cut from the wrap AS IT WAS, so the width they were cut at is
  // part of the result. Stamp it, and hand the cached split back only while
  // that width still holds: at any other one the groups re-wrap inside their
  // own boxes, which is how a line ends up printed twice. Scrubbed callers
  // (the yard, the intro) drive this every frame, so they re-measure by
  // themselves the moment a window changes size.
  const width = String(Math.round(window.innerWidth));
  // The stamp records that this element was PREPARED at this width, not that
  // it was split at it — some elements are deliberately never split (a flex
  // row) and some cannot be (a panel with no width yet). Keying the cache on
  // the split alone meant those elements missed it on every single call, and
  // a scrubbed block re-split itself every frame: each pass rewound `--wipe`
  // to 0, so text the reader had already watched arrive kept vanishing.
  if (el.dataset.wipeAt === width) {
    const ready = [...el.querySelectorAll<HTMLElement>(".u-wipe")];
    if (ready.length) return ready;
    if (el.classList.contains("u-wipe")) return [el];
  }

  const lines = splitLines(el, { mask: opts.mask ?? false });
  el.dataset.splitWidth = width;
  el.dataset.wipeAt = width;
  // A flex or grid box comes back unsplit on purpose: its children are placed
  // by the container, and replacing them with line boxes would rearrange the
  // design rather than reveal it. Wipe what actually holds the words — the
  // element itself when the text is its own, otherwise each text-bearing
  // child, so a row like `<li><span>Name</span><span class="dot"/></li>`
  // reveals its name in the name's own colour and leaves the dot alone.
  let targets: HTMLElement[];
  if (lines.length) {
    targets = lines.map(wipeHost);
  } else {
    const ownText = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && !!(n.nodeValue ?? "").trim(),
    );
    const kids = [...el.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && !!(c.textContent ?? "").trim(),
    );
    targets = ownText || !kids.length ? [el] : kids;
  }
  for (const t of targets) {
    // Read the ink FIRST. `.u-wipe` sets color:transparent, so currentColor
    // inside the gradient would resolve against that very declaration and
    // paint the revealed text transparent — the colour has to be captured
    // before the class lands and pinned as a real value. Per TARGET, not per
    // element: a two-tone heading settles each line to its own tone.
    const final = getComputedStyle(t).color;
    const align = getComputedStyle(t).textAlign;
    t.classList.add("u-wipe");
    // Shrink-wrap the line: a full-width box would make the gradient spend
    // most of its travel sweeping empty measure to the right of a short line
    // instead of crossing glyphs.
    //
    // BLOCK, not inline-block. An inline-block sits in a line box and that
    // line box keeps its parent's STRUT, so a line whose own leading is
    // tighter than the inherited one is padded out — every caption line grew
    // a few px and the split stopped being metrically free (which is what
    // made the client board's two copies drift apart and print twice).
    // A block box with a fit-content width shrink-wraps with no line box of
    // its own at all; alignment, which the inline-block used to get from
    // text-align, is restored with auto margins.
    if (lines.length && t !== el) {
      t.style.display = "block";
      t.style.width = "fit-content";
      if (align === "right" || align === "end") t.style.marginLeft = "auto";
      else if (align === "center") {
        t.style.marginLeft = "auto";
        t.style.marginRight = "auto";
      }
    }
    // Unrevealed until something animates it — set inline so the element is
    // never painted in its final state for a frame before the tween starts.
    t.style.setProperty("--wipe", "0");
    t.style.setProperty("--wipe-final", final);
    if (opts.edge) t.style.setProperty("--wipe-edge", opts.edge);
  }
  return targets;
}

/**
 * Append the wipe onto a timeline the CALLER owns, at `at`.
 *
 * Not "build a child timeline and add it": a child that has been started and
 * is then handed to a parent ends up with two playheads driving it, and it
 * stalls part-way across the line. Writing the tweens straight onto the
 * caller's timeline leaves exactly one clock in charge.
 */
export function addWipeTo(
  tl: gsap.core.Timeline,
  targets: HTMLElement[],
  opts: WipeOptions = {},
  at: number = 0,
): gsap.core.Timeline {
  const { duration, stagger = 0.26, ease = "power1.inOut" } = opts;
  targets.forEach((t, i) => {
    tl.to(t, { "--wipe": 100, duration: duration ?? wipeDuration(t), ease }, at + i * stagger);
  });
  return tl;
}

/**
 * Build the tween for already-prepared targets. Returns a STANDALONE timeline
 * that plays on creation — for callers with no sequence of their own. Inside
 * an existing timeline use addWipeTo instead.
 */
export function wipeTimeline(targets: HTMLElement[], opts: WipeOptions = {}): gsap.core.Timeline {
  return addWipeTo(gsap.timeline(), targets, opts, opts.delay ?? 0);
}

/** Prepare + tween in one call, for the common case. */
export function wipeIn(el: HTMLElement, opts: WipeOptions = {}): gsap.core.Timeline {
  return wipeTimeline(prepareWipe(el, { edge: opts.edge }), opts);
}


/* ── Scrubbed groups ─────────────────────────────────────────────────────────
   The pinned yard has no scroll triggers of its own: every layer is driven
   per frame from the act's own progress. So its text cannot use the tween
   above — it needs the wipe as a FUNCTION of a beat the section already
   computes (the copy band's rise, a card's entrance, the sea headline's
   landing). wipeGroup is that: hand it a block and a 0..1 progress and it
   prepares the text leaves once, then drives every line from the same
   number, staggered, writing only when a value actually changes. */

const LEAF = "h1, h2, h3, h4, p, blockquote, figcaption, li";
/** How much of the progress range one line's own wipe occupies. */
const LINE_SPAN = 0.62;

interface Group {
  lines: HTMLElement[];
  last: number[];
  /** The viewport width these lines were cut at — stale at any other. */
  width: number;
}

const groups = new WeakMap<HTMLElement, Group>();

export function wipeGroup(root: HTMLElement | null, p: number, span = LINE_SPAN): void {
  if (!root) return;
  // The cached lines are only good for the width they were cut at. A frame
  // costs one integer compare to notice otherwise, and re-preparing hands
  // back a fresh cut — so a scrubbed block re-measures itself the first
  // frame after a resize, with no listener anywhere.
  const width = Math.round(window.innerWidth);
  let g = groups.get(root);
  if (g && g.width !== width) g = undefined;
  if (!g) {
    // Leaves only: splitting a wrapper would flatten the markup inside it.
    const leaves = [...root.querySelectorAll<HTMLElement>(LEAF)].filter(
      (el) => el.parentElement?.closest(LEAF) == null,
    );
    const lines = (leaves.length ? leaves : [root]).flatMap((el) => prepareWipe(el));
    g = { lines, last: lines.map(() => -1), width };
    groups.set(root, g);
  }

  const n = g.lines.length;
  const step = n > 1 ? (1 - span) / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const v = Math.round(clamp01((p - i * step) / span) * 1000) / 10;
    if (v === g.last[i]) continue;
    g.last[i] = v;
    g.lines[i].style.setProperty("--wipe", String(v));
  }
}

/**
 * The same arrival for things that are not text — a pictogram, a rule.
 * There is no edge to travel across a drawing, so the reveal is the COLOUR:
 * it lands in brand blue and settles to its own ink, on the beat its card
 * is being wiped by. Written straight to style, deduped per element.
 */
const accents = new WeakMap<HTMLElement, { o: number; c: number }>();

export function wipeAccent(el: HTMLElement | null, p: number, final = "currentColor"): void {
  if (!el) return;
  const o = Math.round(clamp01((p - 0.04) / 0.26) * 100) / 100;
  const c = Math.round(clamp01((p - 0.36) / 0.44) * 100);
  const last = accents.get(el);
  if (last && last.o === o && last.c === c) return;
  accents.set(el, { o, c });
  el.style.opacity = String(o);
  el.style.color = `color-mix(in oklab, ${final} ${c}%, var(--color-beam))`;
}

/** Land on the finished state — reduced motion, or a bail-out. */
export function wipeSettle(targets: HTMLElement[]): void {
  for (const t of targets) t.style.setProperty("--wipe", "100");
}
