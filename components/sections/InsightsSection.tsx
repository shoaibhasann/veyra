/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * NIGHT FALLS. The carrier board's paper runs into a dome — the hero's arc
 * played backwards, black at the curve and paper at the top — and under it
 * the page turns over to the desk: what actually moved this week, in the
 * lanes the reader ships on.
 *
 * The arc is CSS only (`.outro-cover` + `.intro-cover-sky` in globals),
 * which is why it costs nothing on mobile and survives reduced motion.
 */

interface Item {
  date: string;
  title: string;
  tag: string;
}

const ITEMS: Item[] = [
  {
    date: "12 Aug 2026",
    title: "Pre-clearance pilot cuts average dwell time 22% at three regional hubs",
    tag: "Customs",
  },
  {
    date: "09 Aug 2026",
    title: "Typhoon track forces 48-hour berthing delays across South China gateways",
    tag: "Asia Pacific",
  },
  {
    date: "04 Aug 2026",
    title: "Grid-scale battery programme moved end to end on a single project plan",
    tag: "Case study",
  },
  {
    date: "28 Jul 2026",
    title: "Revised tariff schedule takes effect on trans-Pacific lanes from September",
    tag: "Regulation",
  },
  {
    date: "21 Jul 2026",
    title: "Chilled export lane rebuilt around pre-lodged classifications, zero detentions",
    tag: "Case study",
  },
  {
    date: "15 Jul 2026",
    title: "Fleet-wide fuel efficiency agreement signals another year of rate discipline",
    tag: "Global",
  },
];

export default function InsightsSection() {
  return (
    <section id="insights" className="relative w-full bg-night text-paper">
      {/* The dome. Everything below the curve is transparent, so the section's
          own night shows through and the boundary is a dissolve, not a line. */}
      <div aria-hidden className="outro-cover relative h-[130svh] w-full">
        <div className="intro-cover-sky absolute inset-0" />
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-5 pb-24 md:px-8 md:pb-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 font-mono text-[0.7rem] tracking-[0.28em] text-paper/45 uppercase">
              <span aria-hidden className="h-px w-10 bg-signal" />
              (06) Insights
            </p>
            <h2 className="u-display mt-6 text-[clamp(2rem,5.4vw,4.8rem)] leading-[0.95]">
              <span className="block text-paper/35">What&rsquo;s moving</span>
              <span className="block">in your industry</span>
            </h2>
          </div>

          <div className="lg:col-span-5 lg:pt-16">
            <p className="max-w-[42ch] text-base leading-relaxed text-paper/60">
              What actually changed this week across APAC trade — new rules, new
              routings, and the lanes our own desks had to re-plan because of them.
            </p>
            <a
              href="#contact"
              className="mt-8 inline-flex items-center gap-3 rounded-full border border-paper/25 px-8 py-4 font-mono text-[11px] tracking-[0.24em] text-paper uppercase transition-colors duration-300 hover:border-paper hover:bg-paper hover:text-night focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
            >
              View all
            </a>
          </div>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-16 md:mt-20">
          {/* The wire: date, headline, desk — one row each, hairline ruled. */}
          <ul className="lg:col-span-8">
            {ITEMS.map((item) => (
              <li key={item.title} className="border-t border-paper/12 last:border-b">
                <a
                  href="#contact"
                  className="group grid grid-cols-1 gap-1 py-6 transition-colors duration-300 hover:bg-paper/[0.03] md:grid-cols-[9rem_1fr_9rem] md:items-baseline md:gap-6"
                >
                  <span className="font-mono text-[0.7rem] tracking-[0.2em] text-paper/40 uppercase">
                    {item.date}
                  </span>
                  <span className="text-base leading-snug text-paper transition-colors group-hover:text-paper md:text-[1.05rem]">
                    {item.title}
                  </span>
                  <span className="font-mono text-[0.7rem] tracking-[0.2em] text-paper/40 uppercase md:text-right">
                    {item.tag}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="lg:col-span-4">
            <img
              src="/assets/quoting-desk.webp"
              alt="A Veyra desk pricing a lane on the quoting console"
              width={1600}
              height={1200}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full select-none"
            />
            <p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-paper/50">
              Every rate on this page came out of the same console our desks quote
              from — no spreadsheet round-trip, no overnight wait.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
