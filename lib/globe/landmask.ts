import { COASTLINES } from "./coastlines";

export interface LandMask {
  width: number;
  height: number;
  /** True when the given coordinate falls on land. */
  isLand(lat: number, lng: number): boolean;
}

export type LandMaskSource =
  | { kind: "procedural"; width?: number; height?: number }
  | { kind: "image"; url: string };

/**
 * ── THE ONE LINE ──────────────────────────────────────────────────────────
 * Swap this for `{ kind: "image", url: "/textures/earth-mask.png" }` to drive
 * the dot matrix off a real equirectangular land mask instead of the embedded
 * coastline rings. Nothing else changes: both sources rasterise into the same
 * offscreen 2D canvas and are sampled identically.
 * See public/textures/README.md for the image requirements.
 */
export const LAND_MASK_SOURCE: LandMaskSource = {
  kind: "procedural",
  width: 1024,
  height: 512,
};

/** Equirectangular projection: coordinate -> normalised texture UV. */
function project(lat: number, lng: number): { u: number; v: number } {
  return { u: (lng + 180) / 360, v: (90 - lat) / 180 };
}

function drawCoastlines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  // Stroking as well as filling keeps thin features (Japan, NZ, the
  // Philippines) from dropping below one pixel and vanishing.
  ctx.lineWidth = Math.max(1.5, width / 640);
  ctx.lineJoin = "round";

  for (const ring of COASTLINES) {
    ctx.beginPath();
    for (let i = 0; i < ring.length; i += 2) {
      const { u, v } = project(ring[i + 1], ring[i]);
      const x = u * width;
      const y = v * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load land mask: ${url}`));
    img.src = url;
  });
}

function sampler(data: Uint8ClampedArray, width: number, height: number): LandMask {
  return {
    width,
    height,
    isLand(lat: number, lng: number) {
      const { u, v } = project(lat, lng);
      const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const y = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
      // Red channel only — masks are greyscale, land is bright.
      return data[(y * width + x) * 4] > 127;
    },
  };
}

/**
 * Rasterise a land mask into an offscreen 2D canvas and return a point sampler.
 * Client-only: needs `document`.
 */
export async function createLandMask(
  source: LandMaskSource = LAND_MASK_SOURCE,
): Promise<LandMask> {
  let width: number;
  let height: number;
  let image: HTMLImageElement | null = null;

  if (source.kind === "image") {
    image = await loadImage(source.url);
    width = image.naturalWidth;
    height = image.naturalHeight;
  } else {
    width = source.width ?? 1024;
    height = source.height ?? 512;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas context unavailable for land mask");

  if (image) {
    ctx.drawImage(image, 0, 0, width, height);
  } else {
    drawCoastlines(ctx, width, height);
  }

  const { data } = ctx.getImageData(0, 0, width, height);
  return sampler(data, width, height);
}
