/**
 * THE CURTAIN HANDSHAKE. The loader owns the first two seconds; the hero's
 * load reveal must not spend them playing to a black screen. One promise,
 * resolved when the loader's iris starts opening, is the whole contract —
 * with a hard fallback so a hero on a page WITHOUT a loader (or after a
 * loader error) still animates instead of waiting forever.
 */
const FALLBACK_MS = 2600;

let resolveOpen: (() => void) | null = null;
let opened = false;

const opening: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveOpen = () => {
          if (opened) return;
          opened = true;
          resolve();
        };
        window.setTimeout(() => resolveOpen?.(), FALLBACK_MS);
      });

/** Called by the loader the moment its iris starts to open. */
export function curtainOpening(): void {
  resolveOpen?.();
}

/** Awaited by anything that should play as the page is first seen. */
export function whenCurtainOpens(): Promise<void> {
  return opening;
}

/** True once the curtain has opened — for code that cannot await. */
export function curtainIsOpen(): boolean {
  return opened;
}
