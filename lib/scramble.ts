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

/**
 * The smallest thing a line can hold: one WORD (a slice of a text node) or
 * one element that paints without holding words of its own — a rule, a dot,
 * an inline icon. Each remembers the chain of ancestors it sat under, which
 * is what lets the rebuild put its classes back around it.
 */
interface LineAtom {
  /** Ancestors between the split root (exclusive) and this atom, outermost
      first — the styling that has to survive the rebuild. */
  chain: Element[];
  top: number;
  bottom: number;
  /** A word, or … */
  text?: string;
  /** True for the tail of a word the browser broke: it continues the word
      above rather than starting a new one, so no separator precedes it. */
  joined?: boolean;
  /** … an element to clone whole. */
  node?: Element;
}

function chainOf(node: Node, root: HTMLElement): Element[] {
  const chain: Element[] = [];
  let parent = node.parentElement;
  while (parent && parent !== root) {
    chain.unshift(parent);
    parent = parent.parentElement;
  }
  return chain;
}

/**
 * Every atom in `el`, in document order, measured against the UNTOUCHED DOM
 * so the tops are whatever the current wrap actually produced.
 */
function collectAtoms(el: HTMLElement): LineAtom[] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const range = document.createRange();
  const atoms: LineAtom[] = [];

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const pattern = /\S+/g;
      let match = pattern.exec(text.data);
      while (match) {
        const from = match.index;
        const to = from + match[0].length;
        range.setStart(text, from);
        range.setEnd(text, to);
        const rects = range.getClientRects();
        if (rects.length > 1) {
          // A WORD THE BROWSER BROKE. "cross-border" at a line end becomes
          // "cross-" and "border" on two rows, and a word measured by its
          // first rect alone would be filed whole onto the first of them —
          // handing that line more text than it can hold. Rare, and it used
          // to hide: the rebuilt line simply re-wrapped. It cannot hide now
          // that a line may not wrap, so walk the characters and file each
          // fragment on the row it is actually drawn on.
          let runStart = from;
          let runTop = NaN;
          let runBottom = NaN;
          for (let i = from; i <= to; i++) {
            let top = NaN;
            let bottom = NaN;
            if (i < to) {
              range.setStart(text, i);
              range.setEnd(text, i + 1);
              const cr = range.getClientRects()[0] ?? range.getBoundingClientRect();
              top = cr.top;
              bottom = cr.bottom;
            }
            if (Number.isNaN(runTop)) {
              runTop = top;
              runBottom = bottom;
              continue;
            }
            if (i === to || Math.abs(top - runTop) > 1) {
              atoms.push({
                chain: chainOf(text, el),
                top: runTop,
                bottom: runBottom,
                text: text.data.slice(runStart, i),
                joined: runStart > from,
              });
              runStart = i;
              runTop = top;
              runBottom = bottom;
            }
          }
        } else {
          const r = rects.length ? rects[0] : range.getBoundingClientRect();
          atoms.push({ chain: chainOf(text, el), top: r.top, bottom: r.bottom, text: match[0] });
        }
        match = pattern.exec(text.data);
      }
    } else {
      const e = node as Element;
      // An element that HOLDS text is only an ancestor — its words carry it
      // into the rebuild. One that holds none but still paints is an atom.
      if (e.tagName !== "BR" && !(e.textContent ?? "").trim()) {
        const r = e.getBoundingClientRect();
        if (r.width || r.height) {
          atoms.push({ chain: chainOf(e, el), top: r.top, bottom: r.bottom, node: e });
        }
      }
    }
    node = walker.nextNode();
  }
  return atoms;
}

/**
 * Rebuild one line, cloning each atom's ancestor chain around it so classes,
 * inline styles and tone survive the split. Consecutive atoms that shared an
 * ancestor share its clone, so `<span class="muted">two words</span>` comes
 * out as one span holding two words rather than two spans holding one each.
 */
function fillLine(
  inner: HTMLElement,
  group: LineAtom[],
  line: number,
  span: Map<Element, { first: number; last: number }>,
): void {
  let openChain: Element[] = [];
  let openClones: HTMLElement[] = [];
  let wroteAtom = false;

  for (const atom of group) {
    // Reuse the clones whose source ancestors we are still inside.
    let depth = 0;
    while (
      depth < atom.chain.length &&
      depth < openChain.length &&
      atom.chain[depth] === openChain[depth]
    ) {
      depth++;
    }
    openChain = openChain.slice(0, depth);
    openClones = openClones.slice(0, depth);
    for (let i = depth; i < atom.chain.length; i++) {
      const source = atom.chain[i];
      const clone = source.cloneNode(false) as HTMLElement;
      // FRAGMENTATION. An ancestor spanning three lines is cloned into three
      // boxes, and its spacing would otherwise be charged three times — the
      // `mt-2` on a caption's role span became a gap between every line of
      // it. Only the first fragment opens the box and only the last closes
      // it, which is what a browser does to an inline box it breaks.
      const reach = span.get(source);
      if (reach && reach.first < line) {
        clone.style.marginTop = "0";
        clone.style.paddingTop = "0";
        clone.style.borderTopWidth = "0";
      }
      if (reach && reach.last > line) {
        clone.style.marginBottom = "0";
        clone.style.paddingBottom = "0";
        clone.style.borderBottomWidth = "0";
      }
      (openClones[i - 1] ?? inner).appendChild(clone);
      openChain.push(source);
      openClones.push(clone);
    }
    const host = openClones[atom.chain.length - 1] ?? inner;

    // The separator goes inside whichever host is current: inline whitespace
    // collapses the same either side of a tag, and this needs no lookahead.
    if (wroteAtom && !atom.joined) host.appendChild(document.createTextNode(" "));
    if (atom.node) host.appendChild(atom.node.cloneNode(true));
    else host.appendChild(document.createTextNode(atom.text ?? ""));
    wroteAtom = true;
  }
}

/**
 * Groups words into real line boxes by measuring each word with a Range against
 * the untouched DOM, so the result matches whatever the current wrap produces.
 * Re-run it on resize to re-measure.
 *
 * Returns the inner spans — animate those; their parent is the clipping box.
 *
 * Inline markup SURVIVES: each line is rebuilt by cloning the ancestor chain
 * around every word, so a muted second line, a bold name or a rule before an
 * eyebrow comes back exactly as authored. (Flattening it was invisible while
 * only the hero split itself, and became a site-wide defect the moment every
 * heading and caption went through here.)
 *
 * Flex and grid boxes are left ALONE — their children are laid out by the
 * container, and replacing them with line boxes would rearrange the design
 * rather than reveal it. The caller wipes those whole.
 */
export function splitLines(
  el: HTMLElement,
  opts: SplitLinesOptions = {},
): HTMLSpanElement[] {
  const { mask = true } = opts;

  restore(el);

  const display = getComputedStyle(el).display;
  if (display.includes("flex") || display.includes("grid")) return [];

  const label = accessibleLabel(el);
  const atoms = collectAtoms(el);
  if (!atoms.some((a) => a.text)) return [];

  // Lines come from the WORDS: an element atom can sit anywhere in the line
  // box (a centred 1px rule does not share the text's top), so it joins the
  // line its centre is nearest instead of starting one of its own.
  const tops: number[] = [];
  for (const atom of atoms) {
    if (!atom.text) continue;
    if (!tops.length || Math.abs(atom.top - tops[tops.length - 1]) > 1) tops.push(atom.top);
  }
  const groups: LineAtom[][] = tops.map(() => []);
  for (const atom of atoms) {
    const mid = (atom.top + atom.bottom) / 2;
    let best = 0;
    for (let i = 1; i < tops.length; i++) {
      if (Math.abs(tops[i] - (atom.text ? atom.top : mid)) < Math.abs(tops[best] - (atom.text ? atom.top : mid))) {
        best = i;
      }
    }
    groups[best].push(atom);
  }

  // How far each ancestor reaches, in lines — the fragmentation map.
  const span = new Map<Element, { first: number; last: number }>();
  groups.forEach((group, line) => {
    for (const atom of group) {
      for (const ancestor of atom.chain) {
        const reach = span.get(ancestor);
        if (!reach) span.set(ancestor, { first: line, last: line });
        else reach.last = Math.max(reach.last, line);
      }
    }
  });

  const lines: HTMLSpanElement[] = [];
  const frag = document.createDocumentFragment();

  let index = -1;
  for (const group of groups) {
    index++;
    if (!group.length) continue;
    const box = document.createElement("span");
    box.className = "v-line";
    box.setAttribute("aria-hidden", "true");
    box.style.display = "block";
    // Clipping belongs to the MASK, and only to it: it hides the line while
    // it rises into place. Clipping every line was defensive — against a
    // grouping measured just before a resize — and it cost more than it
    // saved, because a line that legitimately sits a few px past its column
    // (a row that filled the measure exactly; see nowrap below) lost the end
    // of its last word to it. A stale grouping now gets re-measured instead.
    if (mask) {
      box.style.overflow = "hidden";
      // Pull the clip below the baseline so descenders survive.
      box.style.paddingBottom = "0.14em";
      box.style.marginBottom = "-0.14em";
    }

    const inner = document.createElement("span");
    inner.className = cx("v-line-inner", opts.lineClass);
    inner.style.display = "block";
    // ONE ROW, always. These words were on one row when they were measured,
    // and a line that filled the measure exactly would otherwise re-wrap the
    // moment it is re-boxed: the browser lets a line's trailing space hang
    // past the edge, a shrink-to-fit box counts it, and 598px of words in a
    // 598px column becomes two rows. Then the split is no longer metrically
    // free and two copies of the same board drift apart.
    inner.style.whiteSpace = "nowrap";
    inner.style.willChange = "transform";
    fillLine(inner, group, index, span);

    box.appendChild(inner);
    frag.appendChild(box);
    lines.push(inner);
  }

  el.replaceChildren(frag);
  if (label) el.setAttribute("aria-label", label);
  el.dataset.split = "lines";

  // A split is only as good as the measurement behind it, and some elements
  // cannot be measured when they are asked: a collapsed accordion row, a
  // hidden panel, a block whose column has not been sized yet. Those report
  // a wrap the reader will never see, and committing it leaves rows that do
  // not fit the box they were cut for. So CHECK, against the layout that now
  // exists — and where a line cannot fit, put the original markup back and
  // report no split, which leaves the caller wiping the element whole.
  // Was the measurement even real? A collapsed accordion row, a hidden panel
  // or a column that has not been sized yet all report a wrap the reader will
  // never see. Those miss by a mile — no width at all, or a line that needs
  // half again the space it was given. A line a few px past its column is NOT
  // that: it is a row that filled the measure exactly, and rejecting the
  // whole split over it left the block wiped as one box, which is the state
  // the reveal looked broken in.
  const misfit = lines.some((inner) => {
    const box = inner.parentElement as HTMLElement | null;
    if (!box) return true;
    const room = box.clientWidth;
    return room < 1 || inner.scrollWidth > room * 1.15 + 8;
  });
  if (misfit) {
    const cached = originals.get(el);
    if (cached !== undefined) el.innerHTML = cached;
    el.removeAttribute("aria-label");
    delete el.dataset.split;
    return [];
  }

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
