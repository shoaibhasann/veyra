"use client";

import { useEffect, useState } from "react";

// Invented freight headlines — generic trade/logistics phrasing, no real events.
const HEADLINES = [
  "Typhoon track forces 48-hour berthing delays across South China gateway ports",
  "Revised tariff schedule takes effect on trans-Pacific lanes from September 1",
  "Carriers file peak-season GRI on Asia–Europe and intra-Asia services",
  "Customs pre-clearance pilot cuts average dwell time 22% at regional hubs",
];

const CYCLE_MS = 6000;
const FADE_MS = 350;

export default function NewsTicker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(!mobile.matches && !reduce.matches);
    update();
    mobile.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!animate) return;
    let fade = 0;
    const cycle = window.setInterval(() => {
      setVisible(false);
      fade = window.setTimeout(() => {
        setIndex((i) => (i + 1) % HEADLINES.length);
        setVisible(true);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(fade);
    };
  }, [animate]);

  return (
    <p
      aria-live="off"
      className="flex min-w-0 items-baseline gap-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#9A9A9A]"
    >
      <span className="shrink-0 text-paper/75">News:</span>
      <span
        className={`block min-w-0 truncate transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {HEADLINES[index]}
      </span>
    </p>
  );
}
