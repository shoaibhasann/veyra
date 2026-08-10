import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Registering touches document, so it only happens in the browser. Module
// caching makes this run once; the flag additionally survives HMR re-evaluation.
let registered = false;

if (typeof window !== "undefined" && !registered) {
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export { gsap, ScrollTrigger };

/** True when the visitor asked the OS to cut motion down. Safe during SSR. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
