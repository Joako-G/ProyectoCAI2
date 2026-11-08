import { describe, expect, it } from 'vitest';
import { CAMERA_PANE, FALLBACK_FRAME, frameForFace } from './pane-geometry';

describe('frameForFace', () => {
  it('falls back to the position of the approved design when there is no face', () => {
    expect(frameForFace(undefined, { width: 640, height: 480 })).toEqual(FALLBACK_FRAME);
    expect(FALLBACK_FRAME).toEqual({ left: 224, top: 201, width: 262, height: 230 });
    expect(CAMERA_PANE).toEqual({ width: 710, height: 700 });
  });

  it('maps a centered face to the center of the pane, mirrored like the video', () => {
    // A 640x480 video covers 710x700 at scale 700/480, so it is 933 px wide and 111 px are cropped per side.
    const frame = frameForFace({ x: 0.3, y: 0.25, width: 0.4, height: 0.5 }, { width: 640, height: 480 });
    expect(frame.top).toBeCloseTo(0.25 * 700, 5);
    expect(frame.height).toBeCloseTo(0.5 * 700, 5);
    expect(frame.width).toBeCloseTo(0.4 * (640 * (700 / 480)), 5);
    expect(frame.left + frame.width / 2).toBeCloseTo(355, 5);
  });

  it('mirrors left and right: a face on the left of the camera image appears on the right of the pane', () => {
    const video = { width: 640, height: 480 };
    const left = frameForFace({ x: 0.05, y: 0.3, width: 0.2, height: 0.3 }, video);
    const right = frameForFace({ x: 0.75, y: 0.3, width: 0.2, height: 0.3 }, video);
    expect(left.left).toBeGreaterThan(right.left);
  });

  it('keeps the frame inside the pane', () => {
    const frame = frameForFace({ x: 0, y: 0, width: 1, height: 1 }, { width: 640, height: 480 });
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(frame.left + frame.width).toBeLessThanOrEqual(710);
    expect(frame.top + frame.height).toBeLessThanOrEqual(700);
  });

  it('assumes a 4:3 video while the real size is not known yet', () => {
    const box = { x: 0.3, y: 0.25, width: 0.4, height: 0.5 };
    expect(frameForFace(box, { width: 0, height: 0 })).toEqual(frameForFace(box, { width: 640, height: 480 }));
  });
});
