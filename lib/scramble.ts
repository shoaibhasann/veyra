import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * Hand-rolled stand-ins for GSAP's paid SplitText and ScrambleTextPlugin.
 *
 * Splitting is destructive, so the pre-split markup is cached per element and
 * restored before every re-split. That makes `splitChars` / `splitLines` safe
 * to call again from a ResizeObserver when the type reflows.
 */

const originals = new WeakMap<HTMLElement, string>();

/**
 * `target` is the text a scramble settles on; `written` is the last string this
 * module put in the element. Comparing `written` against the live textContent is
 * how a re-trigger tells "React gave me new copy" from "that's my own churn".
 */
type ScrambleState = { target: string; written: string };
const scrambleTargets = new WeakMap<HTMLElement, ScrambleState>();
const activeScrambles = new WeakMap<HTMLElement, gsap.core.Tween>();

const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>[]{}#*+=%";

function cx(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

function restore(el: HTMLElement): void {
  const cached = originals.get(el);
  if (cached === undefined) {
    originals.set(el, el.innerHTML);
    return;
  }
  if (el.dataset.split) el.innerHTML = cached;
}

function accessibleLabel(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Undo a split and drop the cached markup. */
export function revertSplit(el: HTMLElement): void {
  const cached = originals.get(el);
  if (cached !== undefined) el.innerHTML = cached;
  el.removeAttribute("aria-label");
  delete el.dataset.split;
  originals.delete(el);
}

export interface SplitCharsOptions {
  charClass?: string;
  wordClass?: string;
}

function splitInto(
  source: Node,
  target: Node,
  chars: HTMLSpanElement[],
  opts: SplitCharsOptions,
): void {
  for (const node of Array.from(source.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const token of (node.nodeValue ?? "").split(/(\s+)/)) {
        if (!token) continue;

        // Whitespace stays a bare text node so the browser keeps its wrap
        // opportunities; inline-block spans would kill them.
        if (/^\s+$/.test(token)) {
          target.appendChild(document.createTextNode(token));
          continue;
        }

        const word = document.createElement("span");
        word.className = cx("v-word", opts.wordClass);
        word.setAttribute("aria-hidden", "true");
        word.style.display = "inline-block";
        word.style.whiteSpace = "nowrap";

        for (const glyph of Array.from(token)) {
          const span = document.createElement("span");
          span.className = cx("v-char", opts.charClass);
          span.style.display = "inline-block";
          span.textContent = glyph;
          word.appendChild(span);
          chars.push(span);
        }

        target.appendChild(word);
      }
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === "BR") {
        target.appendChild(element.cloneNode(false));
        continue;
      }
      const clone = element.cloneNode(false) as HTMLElement;
      splitInto(element, clone, chars, opts);
      target.appendChild(clone);
    }
  }
}

/**
 * Wraps every character in its own inline-block span, grouped into non-breaking
 * word spans. Nested inline markup and `<br>` survive. The parent carries an
 * aria-label so assistive tech reads the sentence, not the fragments.
 */
export function splitChars(
  el: HTMLElement,
  opts: SplitCharsOptions = {},
): HTMLSpanElement[] {
  restore(el);

  const label = accessibleLabel(el);
  const chars: HTMLSpanElement[] = [];
  const frag = document.createDocumentFragment();

  splitInto(el, frag, chars, opts);

  el.replaceChildren(frag);
  if (label) el.setAttribute("aria-label", label);
  el.dataset.split = "chars";

  return chars;
}

export interface SplitLinesOptions {
  /** Wrap each line in an overflow-hidden box so masked reveals clip cleanly. */
  mask?: boolean;
  lineClass?: string;
}

function measureWords(el: HTMLElement): { word: string; top: number }[] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const out: { word: string; top: number }[] = [];

  let node = walker.nextNode() as Text | null;
  while (node) {
    const text = node.data;
    const pattern = /\S+/g;
    let match = pattern.exec(text);
    while (match) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rects = range.getClientRects();
      const top = rects.length ? rects[0].top : range.getBoundingClientRect().top;
      out.push({ word: match[0], top });
      match = pattern.exec(text);
    }
    node = walker.nextNode() as Text | null;
  }

  return out;
}

/**
 * Groups words into real line boxes by measuring each word with a Range against
 * the untouched DOM, so the result matches whatever the current wrap produces.
 * Re-run it on resize to re-measure.
 *
 * Returns the inner spans — animate those; their parent is the clipping box.
 * Note: inline markup inside the element is flattened to text by this pass.
 */
export function splitLines(
  el: HTMLElement,
  opts: SplitLinesOptions = {},
): HTMLSpanElement[] {
  const { mask = true } = opts;

  restore(el);

  const label = accessibleLabel(el);
  const words = measureWords(el);
  if (!words.length) return [];

  const groups: string[][] = [];
  let currentTop = Number.NaN;
  for (const { word, top } of words) {
    if (!groups.length || Math.abs(top - currentTop) > 1) {
      groups.push([word]);
      currentTop = top;
    } else {
      groups[groups.length - 1].push(word);
    }
  }

  const lines: HTMLSpanElement[] = [];
  const frag = document.createDocumentFragment();

  for (const group of groups) {
    const box = document.createElement("span");
    box.className = "v-line";
    box.setAttribute("aria-hidden", "true");
    box.style.display = "block";
    if (mask) {
      box.style.overflow = "hidden";
      // Pull the clip below the baseline so descenders survive.
      box.style.paddingBottom = "0.14em";
      box.style.marginBottom = "-0.14em";
    }

    const inner = document.createElement("span");
    inner.className = cx("v-line-inner", opts.lineClass);
    inner.style.display = "block";
    inner.style.willChange = "transform";
    inner.textContent = group.join(" ");

    box.appendChild(inner);
    frag.appendChild(box);
    lines.push(inner);
  }

  el.replaceChildren(frag);
  if (label) el.setAttribute("aria-label", label);
  el.dataset.split = "lines";

  return lines;
}

export interface ScrambleOptions {
  duration?: number;
  chars?: string;
  delay?: number;
  ease?: string;
  onComplete?: () => void;
}

/**
 * Decode effect: every glyph churns through `chars` and settles left-to-right.
 * Returns the driving tween so it can be dropped into a timeline.
 *
 * Rewrites `textContent`, so point it at a leaf element — not one that has been
 * through `splitChars`. Reads best on the mono cut, where glyph widths match.
 */
export function scrambleText(
  el: HTMLElement,
  opts: ScrambleOptions = {},
): gsap.core.Tween {
  const {
    duration = 1.1,
    chars = DEFAULT_CHARS,
    delay = 0,
    ease = "none",
    onComplete,
  } = opts;

  // A second call supersedes the first; two tweens writing one node would fight.
  activeScrambles.get(el)?.kill();

  const current = el.textContent ?? "";
  let entry = scrambleTargets.get(el);
  if (!entry || current !== entry.written) {
    // Either the first run, or the caller re-rendered the copy underneath us.
    entry = { target: current, written: current };
    scrambleTargets.set(el, entry);
  }

  const state = entry;
  const final = state.target;
  const label = final.replace(/\s+/g, " ").trim();
  if (label) el.setAttribute("aria-label", label);

  if (prefersReducedMotion()) {
    el.textContent = final;
    state.written = final;
    // Keeps the slot the same length inside a timeline.
    return gsap.to({ v: 0 }, { v: 1, duration, delay, ease: "none", onComplete });
  }

  const glyphs = Array.from(final);
  const rendered = glyphs.slice();
  const progress = { p: 0 };
  let tick = 0;

  const render = () => {
    tick++;
    const settled = progress.p * glyphs.length;
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      if (/\s/.test(glyph)) {
        rendered[i] = glyph;
      } else if (i < settled) {
        rendered[i] = glyph;
      } else if ((tick + i) % 2 === 0 || rendered[i] === glyph) {
        // Holding a glyph for a couple of ticks reads as a decode rather than noise.
        rendered[i] = chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    state.written = rendered.join("");
    el.textContent = state.written;
  };

  render();

  const tween = gsap.to(progress, {
    p: 1,
    duration,
    delay,
    ease,
    onUpdate: render,
    onComplete: () => {
      el.textContent = final;
      state.written = final;
      activeScrambles.delete(el);
      onComplete?.();
    },
  });

  activeScrambles.set(el, tween);
  return tween;
}
