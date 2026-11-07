import { describe, expect, it } from 'vitest';
import { regionBrightness } from './brightness';

/** An RGBA image where every pixel is the same gray, except the listed ones. */
function image(width: number, height: number, gray: number, bright: Array<[number, number]> = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([gray, gray, gray, 255], i * 4);
  for (const [x, y] of bright) data.set([255, 255, 255, 255], (y * width + x) * 4);
  return data;
}

describe('regionBrightness', () => {
  it('is the mean luma of the whole image by default', () => {
    expect(regionBrightness(image(4, 4, 100), 4, 4)).toBeCloseTo(100);
    expect(regionBrightness(image(4, 4, 0), 4, 4)).toBe(0);
  });

  it('weights green more than red and blue', () => {
    const red = new Uint8ClampedArray([255, 0, 0, 255]);
    const green = new Uint8ClampedArray([0, 255, 0, 255]);
    expect(regionBrightness(green, 1, 1)).toBeGreaterThan(regionBrightness(red, 1, 1));
  });

  it('measures only the region and clamps it to the image', () => {
    const data = image(4, 4, 0, [[2, 2], [3, 2], [2, 3], [3, 3]]);
    expect(regionBrightness(data, 4, 4, { x: 2, y: 2, width: 2, height: 2 })).toBeCloseTo(255);
    expect(regionBrightness(data, 4, 4, { x: 0, y: 0, width: 2, height: 2 })).toBe(0);
    expect(regionBrightness(data, 4, 4, { x: 2, y: 2, width: 20, height: 20 })).toBeCloseTo(255);
  });

  it('returns 0 for an empty region', () => {
    expect(regionBrightness(image(4, 4, 90), 4, 4, { x: 10, y: 10, width: 2, height: 2 })).toBe(0);
  });
});
