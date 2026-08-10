"use client";

import { useState } from "react";

/**
 * THE DESK, ANSWERING. Three columns on the reference's plan: the label on
 * the left, the questions ruled down the middle, and the way out on the
 * right. Rows open one at a time — a reader comparing two answers is
 * really asking a third question, and that is what the email link is for.
 *
 * A real <button> per row, so keyboard and screen readers get the disclosure
 * for free; the dot is the only decoration and it is aria-hidden.
 */
const FAQS = [
  {
    q: "What does Veyra actually do?",
    a: "We are the single operator on your freight: ocean and air forwarding, cross-border trucking and licensed customs brokerage, run by one team on one contract. You get one rate card, one point of contact and one system showing every leg.",
  },
  {
    q: "Which lanes and industries do you cover?",
    a: "Fourteen APAC countries through our own offices and bonded partners, with the heaviest volumes on China–Australia, Southeast Asia–New Zealand and intra-ASEAN. We move chilled and ambient FMCG, industrial equipment, project cargo and retail replenishment.",
  },
  {
    q: "How is a rate actually calculated?",
    a: "From the lane, the equipment, the season and the compliance work it genuinely needs — quoted once, in writing, gate to gate. There is no fuel-surcharge reveal at invoice and no mid-voyage re-rate.",
  },
  {
    q: "Do you handle customs clearance in-house?",
    a: "Yes. Our brokers are licensed and salaried, not subcontracted, and classifications are lodged before the vessel berths rather than after. That is what keeps detention and demurrage off the invoice.",
  },
  {
    q: "Can you take oversized or heavy-lift cargo?",
    a: "Out-of-gauge and heavy-lift moves are engineered from route survey to set-down, including permits, escorts and lift plans. Send dimensions and a delivery window and you will have a method statement, not a maybe.",
  },
  {
    q: "What visibility do I get while freight is moving?",
    a: "A live position and ETA on every leg, refreshed from the carrier and the cab, on the same feed your customer can be given. Exceptions reach you as a call from the controller who owns your lane, before you notice them.",
  },
  {
    q: "Do you offer warehousing and 3PL?",
    a: "Bonded and ambient space across nine ports, with pick, pack and cross-dock billed by the pallet-day. It is run on the same system as the freight, so stock and transit are one picture.",
  },
  {
    q: "How do I start?",
    a: "Send a lane, a commodity and a volume. You will have an indicative rate the same working day and a full quotation, with compliance notes, inside four hours of the details being confirmed.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="w-full bg-paper py-24 text-ink md:py-32">
      <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 md:px-8 lg:grid-cols-12 lg:gap-16">
        {/* The label. */}
        <div className="lg:col-span-3">
          <h2 className="u-display text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.9]">F.A.Q</h2>
          <p className="mt-6 max-w-[30ch] text-sm leading-relaxed text-ink/55 sm:text-base">
            Straightforward answers, so you can move forward with confidence.
          </p>
        </div>

        {/* The questions. */}
        <div className="lg:col-span-6">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-t border-ink/12 last:border-b">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center gap-6 py-6 text-left transition-colors duration-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
                >
                  <span className="font-mono text-[0.7rem] tracking-[0.2em] text-ink/35 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-base leading-snug md:text-[1.05rem]">{item.q}</span>
                  <span
                    aria-hidden
                    className={`h-[7px] w-[7px] shrink-0 rounded-full transition-colors duration-300 ${
                      isOpen ? "bg-signal" : "bg-ink/25"
                    }`}
                  />
                </button>

                {/* Grid-rows trick: an auto-height panel that still animates,
                    with no measuring and no max-height guesswork. */}
                <div
                  id={`faq-panel-${i}`}
                  className="grid transition-[grid-template-rows] duration-500 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[62ch] pt-1 pb-7 pl-[3.1rem] text-sm leading-relaxed text-ink/60 sm:text-base">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* The way out. */}
        <div className="lg:col-span-3">
          <p className="max-w-[26ch] text-sm leading-relaxed text-ink/70 sm:text-base">
            Still have questions? Our team is here to help.
          </p>
          <a
            href="mailto:desk@veyra.freight"
            className="mt-6 inline-block font-mono text-[11px] tracking-[0.24em] text-ink uppercase underline decoration-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
          >
            Email us
          </a>
        </div>
      </div>
    </section>
  );
}
