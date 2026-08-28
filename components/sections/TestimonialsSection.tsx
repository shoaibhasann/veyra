/* eslint-disable @next/next/no-img-element */
const TESTIMONIALS = [
  {
    initials: "NR",
    portrait: "/assets/client-nadia.webp",
    name: "Nadia Rahman",
    role: "Head of Supply Chain",
    company: "Selaras Foods, Jakarta",
    quote:
      "We were losing a week a month to customs queries on chilled cargo. Veyra rebuilt our HS classifications, pre-lodged everything, and clearance stopped being a conversation. Two years in, we have not paid a demurrage charge.",
  },
  {
    initials: "WO",
    portrait: "/assets/client-weilin.webp",
    name: "Wei-Lin Ong",
    role: "Logistics Director",
    company: "Kaipara Components, Auckland",
    quote:
      "When the Yantian backlog hit, our old forwarder sent a form email. Veyra had already split the booking across two carriers and moved the urgent SKUs to air. They called us before we called them. That is the whole difference.",
  },
  {
    initials: "AM",
    portrait: "/assets/client-aarav.webp",
    name: "Aarav Menon",
    role: "Chief Operating Officer",
    company: "Tessellate Retail Group, Bengaluru",
    quote:
      "One contract replaced four vendors and about sixty emails a week. The part I did not expect was the rate discipline — the number we agreed in January was still the number we paid in September, on every one of two hundred consignments.",
  },
] as const;

/**
 * THE WHOLE BOARD — heading and clients together, factored out because TWO
 * surfaces render it: this section, and the panel the freighter tows in at
 * the end of the yard pin. Same component, same container, same paddings,
 * so the towed screen already HAS the testimonials on it (the aircraft
 * brings the section, not a title card) and at pin release the real
 * section is the same pixels. Spacing is set so the heading and the first
 * client both land inside one viewport — no dead air under the type.
 */
export function TestimonialsBoard() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pt-24 md:px-8 md:pt-28">
      <p className="flex items-center gap-3 font-mono text-[0.7rem] tracking-[0.28em] text-ink/45 uppercase">
        <span aria-hidden className="h-px w-10 bg-signal" />
        (03) Clients
      </p>

      <h2 className="u-display mt-6 text-[clamp(1.9rem,5vw,4.4rem)] leading-[0.95]">
        <span className="block">Trusted by the teams</span>
        <span className="block text-ink/35">who ship every week</span>
      </h2>

      {/* One client per row: the mark, the attribution, the account in their
          own words — the reference's rhythm, our copy. */}
      <div className="mt-10 md:mt-12">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="border-t border-ink/12 py-9 md:grid md:grid-cols-12 md:gap-10 md:py-11"
          >
            <div className="md:col-span-4 lg:col-span-3">
              {/* The monogram is not a placeholder to be swapped out — it is
                  the FLOOR. It sits in the plate underneath the portrait, so
                  a photo that is missing, still loading or blocked leaves a
                  designed tile rather than a broken-image glyph, and the two
                  boards (this one and the copy the aircraft tows in) always
                  measure the same either way. The fallback is pure layout —
                  an empty-alt image that fails to load paints nothing, so no
                  handler (and no client component) is needed to reveal what
                  is already underneath it. */}
              <span
                aria-hidden
                className="font-display relative flex h-[128px] w-[128px] items-center justify-center overflow-hidden rounded-sm bg-ink/[0.055] text-[2rem] font-bold tracking-tight text-ink/60 md:h-[150px] md:w-[150px] md:text-[2.4rem]"
              >
                {t.initials}
                <img
                  src={t.portrait}
                  alt=""
                  width={600}
                  height={600}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 block h-full w-full object-cover select-none"
                />
              </span>
              <figcaption className="mt-5">
                <span className="font-display block text-sm font-bold tracking-[0.06em] uppercase">
                  {t.name}
                </span>
                <span className="mt-2 block text-[0.85rem] leading-snug text-ink/55">
                  {t.role}
                  <br />
                  at {t.company}
                </span>
              </figcaption>
            </div>

            <blockquote className="mt-7 text-[clamp(1.05rem,1.7vw,1.5rem)] leading-[1.4] md:col-span-8 md:col-start-5 md:mt-0">
              {t.quote}
            </blockquote>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      /* No skip here. The section is overlapped under the pin's last screen,
         so its own scroll triggers fire DURING the crossing — behind the
         still-opaque stage — and the first screen is already revealed by the
         time the aircraft hands over. Rows below the fold then wipe as the
         reader reaches them, like every other section. */
      /* Overlapped UNDER the yard pin's last viewport (z-0 to the pin's
         z-10) and pulled up by exactly one screen: at pin release this
         section is already where the towed panel was showing it, pixel for
         pixel, so the reader never sees a second copy — the aircraft
         brought this page and the scroll simply continues down it. */
      className="pin-handoff relative z-0 w-full bg-[#FAF7F7] pb-24 text-ink md:pb-32"
    >
      <TestimonialsBoard />
    </section>
  );
}
