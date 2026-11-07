/** A rectangle of pixels. */
export interface PixelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Mean luma (0 to 255) of RGBA pixel data, over the whole image or one region clamped to the image.
 * Run it on a tiny downscaled canvas (for example 64 by 48): it is a handful of thousand pixels per look.
 */
export function regionBrightness(rgba: ArrayLike<number>, width: number, height: number, region?: PixelRegion): number {
  const x0 = Math.max(0, Math.floor(region?.x ?? 0));
  const y0 = Math.max(0, Math.floor(region?.y ?? 0));
  const x1 = Math.min(width, Math.ceil((region?.x ?? 0) + (region?.width ?? width)));
  const y1 = Math.min(height, Math.ceil((region?.y ?? 0) + (region?.height ?? height)));
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const at = (y * width + x) * 4;
      sum += 0.299 * rgba[at]! + 0.587 * rgba[at + 1]! + 0.114 * rgba[at + 2]!;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}
