"use client";

/**
 * THE CARRIER BOARD. The reference's plate: a hairline grid of partner
 * marks with dotted survey crosses at every intersection, each cell
 * lighting up under the pointer. Ours carries VEYRA's own carrier names —
 * real airline and shipping-line logos are trademarks we have no licence
 * to reprint, so each mark is set as type in its own voice instead. Drop
 * licensed SVGs into `mark` when the partnerships are signed.
 */

interface Carrier {
  name: string;
  /** Per-mark type treatment, so the board reads as logos, not a list. */
  className: string;
}

const AIR: Carrier[] = [
  { name: "AURELIA AIR", className: "font-display text-[1.05rem] font-bold tracking-[0.06em]" },
  { name: "Nimbus Cargo", className: "font-display text-[1.15rem] font-medium tracking-[-0.02em]" },
  { name: "SORA AIRWAYS", className: "font-mono text-[0.95rem] tracking-[0.18em]" },
  { name: "Pacific Kite", className: "font-display text-[1.2rem] font-bold italic tracking-[-0.03em]" },
  { name: "MERIDIAN AIR", className: "font-display text-[1rem] font-bold tracking-[0.14em]" },
  { name: "Bluebird SkyCargo", className: "font-display text-[1.05rem] font-medium tracking-[-0.01em]" },
  { name: "ATLAS WING", className: "font-mono text-[0.9rem] font-bold tracking-[0.2em]" },
  { name: "Halia Airways", className: "font-display text-[1.15rem] font-medium tracking-[-0.02em]" },
  { name: "ZENITH AIR", className: "font-display text-[1.1rem] font-bold tracking-[0.08em]" },
  { name: "Sunda Air", className: "font-display text-[1.25rem] font-bold tracking-[-0.04em]" },
];

const OCEAN: Carrier[] = [
  { name: "NORTHWIND LINES", className: "font-display text-[0.95rem] font-bold tracking-[0.1em]" },
  { name: "Kuroshio Line", className: "font-display text-[1.15rem] font-medium tracking-[-0.02em]" },
  { name: "SELAT SHIPPING", className: "font-mono text-[0.85rem] tracking-[0.18em]" },
  { name: "Pelagos", className: "font-display text-[1.35rem] font-bold tracking-[-0.05em]" },
  { name: "ANDAMAN LINES", className: "font-display text-[0.95rem] font-bold tracking-[0.12em]" },
];

/** The survey cross that sits on every grid intersection. */
function Cross({ className }: { className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute z-10 ${className}`}>
      <span className="relative block h-[7px] w-[7px]">
        <i className="absolute top-0 left-0 h-[1.5px] w-[1.5px] rounded-full bg-ink/35" />
        <i className="absolute top-0 right-0 h-[1.5px] w-[1.5px] rounded-full bg-ink/35" />
        <i className="absolute bottom-0 left-0 h-[1.5px] w-[1.5px] rounded-full bg-ink/35" />
        <i className="absolute right-0 bottom-0 h-[1.5px] w-[1.5px] rounded-full bg-ink/35" />
      </span>
    </span>
  );
}

function Board({ label, carriers }: { label: string; carriers: Carrier[] }) {
  return (
    <div className="mt-10 md:mt-14">
      <p className="font-mono text-[0.7rem] tracking-[0.24em] text-ink/40 uppercase">{label}</p>

      <div className="mt-5 grid grid-cols-2 border-t border-l border-ink/12 sm:grid-cols-3 lg:grid-cols-5">
        {carriers.map((c) => (
          <div
            key={c.name}
            className="group relative flex h-[132px] items-center justify-center border-r border-b border-ink/12 px-4 transition-colors duration-300 hover:bg-ink/[0.035] md:h-[168px]"
          >
            {/* Crosses on all four corners; shared corners land on the same
                pixel, so the board reads as one continuous survey grid. */}
            <Cross className="-top-[3px] -left-[3px]" />
            <Cross className="-top-[3px] -right-[3px]" />
            <Cross className="-bottom-[3px] -left-[3px]" />
            <Cross className="-right-[3px] -bottom-[3px]" />

            <span
              className={`${c.className} text-center text-ink/70 transition-colors duration-300 group-hover:text-ink`}
            >
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CarriersSection() {
  return (
    <section id="carriers" className="w-full bg-[#FAF7F7] py-20 text-ink md:py-28">
      <div className="mx-auto w-full max-w-[1440px] px-5 md:px-8">
        <p className="flex items-center gap-3 font-mono text-[0.7rem] tracking-[0.28em] text-ink/45 uppercase">
          <span aria-hidden className="h-px w-10 bg-signal" />
          (04) Carrier network
        </p>

        <h2 className="u-display mt-6 max-w-[20ch] text-[clamp(1.7rem,4vw,3.4rem)] leading-[1]">
          Allocation on the carriers that actually serve your lane.
        </h2>

        <Board label="Air partners" carriers={AIR} />
        <Board label="Ocean partners" carriers={OCEAN} />
      </div>
    </section>
  );
}
