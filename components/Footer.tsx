/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * THE COLOPHON. Everything a freight buyer looks for after they have decided
 * — where the desk is, when it answers, what it covers, and how the money is
 * handled — laid out on the reference's plan and closed with the wordmark cut
 * as a dot screen.
 *
 * The industries/services strip is a real toggle rather than two marquees:
 * one row of scope, switchable, so the footer states coverage without turning
 * into a second navigation.
 */
const COMPANY = [
  { label: "Home", href: "#top" },
  { label: "About us", href: "#about" },
  { label: "Careers", href: "#contact" },
];
const RESOURCES = [
  { label: "Insights", href: "#insights" },
  { label: "Clients", href: "#testimonials" },
  { label: "F.A.Q", href: "#faq" },
];
const REACH = [
  { label: "Carriers", href: "#carriers" },
  { label: "Partners", href: "#partners" },
  { label: "Contact us", href: "#contact" },
];

const SCOPE = {
  Industries: [
    "Food & Beverage",
    "Automotive & Industrial Equipment",
    "Mining & Resources",
    "Building & Construction",
    "Retail & E-commerce",
    "Renewable Energy",
  ],
  Services: [
    "Ocean Freight",
    "Air Freight",
    "Customs Brokerage",
    "Warehousing & 3PL",
    "Project Cargo",
    "Domestic & Interstate",
  ],
} as const;

type ScopeKey = keyof typeof SCOPE;

/** Payment rails, drawn not fetched — six neutral marks, no third-party logos. */
const RAILS = ["VISA", "MC", "AMEX", "UPI", "JCB", "PAY"];

export default function Footer() {
  const [scope, setScope] = useState<ScopeKey>("Industries");
  const trackRef = useRef<HTMLDivElement>(null);

  // THE SCOPE LINE, running. The track holds the list TWICE, so -50% is
  // exactly one seamless lap whatever the copy length — and because the tween
  // is rebuilt when the tab changes, switching Industries/Services re-measures
  // instead of drifting against a stale width.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.set(track, { xPercent: 0 });
      gsap.to(track, {
        xPercent: -50,
        duration: 26,
        ease: "none",
        repeat: -1,
      });
    }, track);
    return () => ctx.revert();
  }, [scope]);

  return (
    <footer className="w-full bg-paper pt-20 text-ink md:pt-24">
      <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
        {/* Row one: socials, the three link columns, the money. */}
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">
            <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Socials
            </p>
            <a
              href="#contact"
              aria-label="Veyra on LinkedIn"
              className="mt-5 flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 font-display text-[0.7rem] font-bold tracking-tight transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
            >
              in
            </a>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6">
            <div>
              <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
                Company
              </p>
              <ul className="mt-5 space-y-3">
                {COMPANY.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[0.95rem] text-ink/80 transition-colors hover:text-ink">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
                Read
              </p>
              <ul className="mt-5 space-y-3">
                {RESOURCES.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[0.95rem] text-ink/80 transition-colors hover:text-ink">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
                Network
              </p>
              <ul className="mt-5 space-y-3">
                {REACH.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[0.95rem] text-ink/80 transition-colors hover:text-ink">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="lg:col-span-3">
            <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Secure payments
            </p>
            <p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-ink/60">
              Card payments run through a PCI-DSS compliant gateway. Card details
              are never stored by us.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Accepted payment methods">
              {RAILS.map((r) => (
                <li
                  key={r}
                  className="rounded-[3px] border border-ink/15 px-2.5 py-1.5 font-mono text-[0.6rem] tracking-[0.12em] text-ink/50"
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Row two: scope, as one switchable line. */}
        <div className="mt-16 md:mt-20">
          <div
            role="tablist"
            aria-label="Coverage"
            className="inline-flex rounded-full border border-ink/12 p-1"
          >
            {(Object.keys(SCOPE) as ScopeKey[]).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={scope === key}
                onClick={() => setScope(key)}
                className={`rounded-full px-5 py-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal ${
                  scope === key ? "bg-ink text-paper" : "text-ink/50 hover:text-ink"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-hidden">
            <div
              ref={trackRef}
              className="flex w-max gap-10 whitespace-nowrap text-[clamp(1.05rem,2.4vw,1.9rem)] leading-snug text-ink/25 will-change-transform"
            >
              {/* Two identical runs: the lap length IS the first run's width. */}
              {[0, 1].map((run) => (
                <span key={run} aria-hidden={run === 1} className="flex shrink-0 gap-10">
                  {SCOPE[scope].map((item) => (
                    <span key={item} className="shrink-0">
                      {item}
                      <span className="pl-10 text-ink/15">·</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Row three: where we are, how to reach us, where we operate. */}
        <div className="mt-14 grid gap-12 border-t border-ink/12 pt-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">
            <img
              src="/assets/interchange.webp"
              alt=""
              aria-hidden
              width={1600}
              height={1200}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full max-w-[340px] select-none grayscale"
            />
          </div>

          <div className="lg:col-span-3">
            <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Head office
            </p>
            <p className="mt-4 leading-relaxed">
              14 Kallang Junction,
              <br />
              Singapore 339263.
            </p>
            <a
              href="#contact"
              className="mt-4 inline-block text-sm underline decoration-ink/30 underline-offset-[6px] transition-colors hover:decoration-ink"
            >
              ↳ Directions
            </a>

            <p className="mt-10 font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Operating across
            </p>
            <p className="mt-4 leading-relaxed">
              Singapore / Malaysia / Australia / New Zealand
            </p>
          </div>

          <div className="lg:col-span-3">
            <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Email
            </p>
            <a href="mailto:desk@veyra.freight" className="mt-4 inline-block transition-colors hover:text-ink">
              desk@veyra.freight
            </a>

            <p className="mt-10 font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Control tower
            </p>
            <p className="mt-4">+65 6000 0142</p>

            <p className="mt-10 font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Desk hours
            </p>
            <p className="mt-4">Monday – Friday / 08:30 – 18:00 SGT</p>
            <p className="mt-1 text-sm text-ink/50">Exceptions desk, 24/7.</p>
          </div>

          <div className="lg:col-span-3">
            <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">
              Network
            </p>
            {/* A dot-screen world, drawn as a CSS grid of points — no map
                asset to ship, and it re-colours with the theme. */}
            <div
              aria-hidden
              className="mt-5 h-[130px] w-full"
              style={{
                backgroundImage:
                  "radial-gradient(currentColor 1px, transparent 1.1px)",
                backgroundSize: "9px 9px",
                color: "rgba(17,17,17,0.28)",
                maskImage:
                  "radial-gradient(120% 90% at 30% 45%, #000 38%, transparent 72%), radial-gradient(70% 80% at 78% 60%, #000 34%, transparent 74%)",
                WebkitMaskImage:
                  "radial-gradient(120% 90% at 30% 45%, #000 38%, transparent 72%), radial-gradient(70% 80% at 78% 60%, #000 34%, transparent 74%)",
              }}
            />
          </div>
        </div>

        {/* Row four: the legal line. */}
        <div className="mt-14 flex flex-col gap-4 border-t border-ink/12 py-8 font-mono text-[0.62rem] tracking-[0.16em] text-ink/45 uppercase lg:flex-row lg:items-center lg:justify-between">
          <p>© 2026 Veyra Freight Pte Ltd</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {["Privacy policy", "Terms", "Payment policy", "Delivery policy", "Cookie settings"].map(
              (l) => (
                <li key={l}>
                  <a href="#contact" className="transition-colors hover:text-ink">
                    {l}
                  </a>
                </li>
              ),
            )}
          </ul>
          <p>All rates in SGD, exclusive of GST</p>
        </div>
      </div>

      {/* The sign-off: the wordmark as a dot screen, cropped by the page. */}
      <div aria-hidden className="relative w-full overflow-hidden">
        <p
          className="u-display w-full text-center leading-[0.78] whitespace-nowrap select-none text-[min(23vw,320px)]"
          style={{
            color: "transparent",
            backgroundImage: "radial-gradient(rgba(17,17,17,0.42) 1px, transparent 1.15px)",
            backgroundSize: "7px 7px",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
        >
          VEYRA
        </p>
      </div>
    </footer>
  );
}
