"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { getLenis } from "@/components/SmoothScroll";
import NewsTicker from "@/components/NewsTicker";

// Every href resolves to a section id that actually exists on this page.
const LINKS = [
  { label: "About", href: "#about" },
  { label: "Insights", href: "#insights" },
  { label: "Clients", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

// Height of the utility ticker strip — the persistent chrome rows sit below it
// while the ticker is on screen, and slide up by this much once it collapses.
const TICKER_OFFSET = "translate-y-[34px]";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lastY = useRef(0);
  const runUp = useRef(0);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      // Collapse the hero-only chrome once the intro cover card occupies
      // ~40% of the viewport (card top at 60% → y = introTop - 0.6·vh =
      // 0.4·vh with the 100vh hero), so it never floats over the blue card.
      setScrolled(y > window.innerHeight * 0.4);

      // Direction-aware chrome: hide while scrolling down, reveal on the way
      // back up. Deltas accumulate per direction so trackpad jitter and Lenis
      // sub-pixel settle can't flicker it.
      const dy = y - lastY.current;
      lastY.current = y;
      runUp.current = dy < 0 ? runUp.current - dy : 0;
      if (y < 120) setHidden(false);
      else if (dy > 2) setHidden(true);
      else if (runUp.current > 24) setHidden(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    // The overlay is lg:hidden — drop the open state at the breakpoint so it
    // can never linger for a panel nobody can see.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Lenis drives window scroll itself, so body overflow alone does not stop it.
    getLenis()?.stop();

    // The overlay covers the page, so keep Tab inside it (panel links + the
    // toggle, which sits in the chrome layer above the panel).
    const focusables = (): HTMLElement[] => {
      const inPanel = panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
          )
        : [];
      return toggleRef.current ? [...inPanel, toggleRef.current] : inPanel;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !active || !items.includes(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const panel = panelRef.current;
    const reduce = prefersReducedMotion();

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-menu-item]");
      if (reduce) {
        gsap.set([panel, ...items], { opacity: 1, y: 0 });
        return;
      }
      gsap
        .timeline()
        .fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" })
        .fromTo(
          items,
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.55, ease: "expo.out", stagger: 0.055 },
          0.08,
        );
    }, panel ?? undefined);

    panel?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      getLenis()?.start();
      document.removeEventListener("keydown", onKey);
      ctx.revert();
    };
  }, [open, close]);

  // Row shift shared by the persistent chrome layers: below the ticker over the
  // hero, flush with the top once the ticker has collapsed.
  const rowShift = `transition-transform duration-500 ease-out ${
    scrolled ? "translate-y-0" : TICKER_OFFSET
  }`;

  return (
    <header>
      {/* ————— Hero-only chrome: utility ticker + vertical menu column. —————
          No bar, no background past the hero — this whole layer exists only
          over the hero and collapses exactly like the old top strip did. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div
          aria-hidden={scrolled}
          className={`overflow-hidden transition-[max-height,opacity] duration-500 ${
            scrolled ? "pointer-events-none max-h-0 opacity-0" : "pointer-events-auto max-h-9 opacity-100"
          }`}
        >
          {/* Inner row translates up as the strip collapses so the exit reads
              as travelling upward, not just a height snap. */}
          <div
            className={`mx-auto flex h-[34px] max-w-[1440px] items-center justify-between gap-6 border-b border-paper/[0.06] px-5 transition-transform duration-500 ease-out md:px-8 ${
              scrolled ? "-translate-y-4" : "translate-y-0"
            }`}
          >
            <NewsTicker />
            <nav aria-label="Utility" className="hidden shrink-0 sm:block">
              <ul className="flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#9A9A9A]">
                <li>
                  <a
                    href="#insights"
                    tabIndex={scrolled ? -1 : 0}
                    className="underline-offset-4 transition-colors duration-300 hover:text-paper hover:underline"
                  >
                    Carbon calculator
                  </a>
                </li>
                <li aria-hidden>
                  <span className="block h-3 w-px bg-paper/15" />
                </li>
                <li>
                  <a
                    href="#contact"
                    tabIndex={scrolled ? -1 : 0}
                    className="underline-offset-4 transition-colors duration-300 hover:text-paper hover:underline"
                  >
                    Live tracking
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Vertical stack anchored at ~40% viewport x, level with the wordmark.
            Only lives on desktop over the hero — past it, the column would sit
            on white content, so it slides up and out with `scrolled`. */}
        <div className="relative mx-auto max-w-[1440px] px-5 md:px-8">
          {/* Exit reads as "animating up and away": each item gets a large
              upward travel with a short per-item stagger (top link leaves
              first). The container only gates pointer events — motion lives
              on the items so the stagger is a pure CSS transition-delay. */}
          <nav
            aria-label="Primary"
            aria-hidden={scrolled}
            className={`absolute left-[40%] top-[1.9rem] hidden lg:block ${
              scrolled ? "pointer-events-none" : "pointer-events-auto"
            }`}
          >
            <ul className="flex flex-col gap-[26px]">
              {LINKS.map((link, i) => (
                <li
                  key={link.href}
                  className={`leading-none transition-[opacity,transform] duration-700 ease-out ${
                    scrolled ? "-translate-y-10 opacity-0" : "translate-y-0 opacity-100"
                  }`}
                  style={{ transitionDelay: scrolled ? `${i * 45}ms` : "0ms" }}
                >
                  <a
                    href={link.href}
                    tabIndex={scrolled ? -1 : 0}
                    className="group flex items-center font-mono text-[12px] uppercase leading-none tracking-[0.18em] text-paper/55 transition-colors duration-300 hover:text-paper focus-visible:text-paper"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-px w-0 bg-signal transition-all duration-300 group-hover:mr-2 group-hover:w-4"
                    />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* ————— Mobile overlay — under the blend chrome, above the page. ————— */}
      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          data-lenis-prevent
          /* Landscape phones are shorter than this panel is tall, so it has to
             scroll on its own — the body is locked while it is open. */
          className="fixed inset-0 z-40 flex flex-col justify-between gap-10 overflow-y-auto overscroll-contain bg-night px-5 pt-24 pb-10 opacity-0 lg:hidden"
        >
          <nav aria-label="Mobile">
            <ul className="flex flex-col">
              {LINKS.map((link) => (
                <li key={link.href} data-menu-item className="opacity-0">
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-paper/10 py-4 font-display text-[2rem] font-extrabold uppercase leading-none tracking-[-0.03em] text-paper"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div data-menu-item className="opacity-0">
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="block rounded-full bg-signal px-6 py-4 text-center text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-paper"
            >
              Get a quote
            </a>
            <p className="mt-6 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-paper/40">
              Singapore · Jakarta · Chennai · Auckland
            </p>
          </div>
        </div>
      )}

      {/* ————— Persistent floating chrome: wordmark + hamburger. —————
          mix-blend-difference lives on THIS fixed wrapper — a blend mode on a
          child of a fixed/z-indexed ancestor gets isolated inside it and never
          reaches the page, so the blend must ride the outermost layer. White
          text turns dark over the white yard, stays light over night sections. */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 mix-blend-difference transition-[transform,opacity] duration-300 ease-out ${
          hidden && !open ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div
          className={`mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-5 md:h-20 md:px-8 ${rowShift}`}
        >
          <a
            href="#top"
            aria-label="Veyra — home"
            className="pointer-events-auto font-display text-[1.4rem] font-extrabold uppercase leading-none tracking-[-0.07em] text-paper md:text-[1.6rem]"
          >
            Veyra
          </a>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => (open ? close() : setOpen(true))}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center text-paper lg:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="relative block h-3.5 w-6">
              <span
                className={`absolute left-0 block h-[2px] w-full bg-current transition-transform duration-300 ${
                  open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 block h-[2px] w-full bg-current transition-transform duration-300 ${
                  open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* ————— Quote pill — its own layer, deliberately OUTSIDE the blend
          wrapper: it stays a solid white pill with dark text and a soft shadow,
          which reads on any background without inverting. Shifted left of the
          hamburger (w-10 + gap-3 = 52px) wherever the toggle is visible. ————— */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 transition-[transform,opacity] duration-300 ease-out ${
          hidden && !open ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div
          className={`mx-auto flex h-16 max-w-[1440px] items-center justify-end px-5 md:h-20 md:px-8 ${rowShift}`}
        >
          <a
            href="#contact"
            className="pointer-events-auto mr-[52px] hidden rounded-full bg-paper px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#050505] shadow-[0_2px_14px_rgba(0,0,0,0.22)] transition-colors duration-300 hover:bg-signal hover:text-paper sm:inline-block lg:mr-0"
          >
            Get a quote
          </a>
        </div>
      </div>
    </header>
  );
}
