import { describe, expect, it } from 'vitest';
import {
  addCapture,
  descriptorDistance,
  ENROLLMENT_CAPTURES,
  EMPTY_PROGRESS,
  MAX_CAPTURE_DISTANCE,
  MAX_CONSECUTIVE_REJECTIONS,
  meanDescriptor,
  type EnrollmentProgress,
} from './enrollment-captures';

const flat = (value: number) => Array.from({ length: 128 }, () => value);
/** A descriptor `distance` away from `flat(0)` in Euclidean terms, spread evenly over the 128 numbers. */
const away = (distance: number) => flat(distance / Math.sqrt(128));

describe('descriptorDistance', () => {
  it('is the Euclidean distance, the same measure face-api and the server use', () => {
    expect(descriptorDistance([0, 0], [3, 4])).toBe(5);
    expect(descriptorDistance(flat(0), away(0.5))).toBeCloseTo(0.5);
  });
});

describe('meanDescriptor', () => {
  it('is the element-wise mean and is not rescaled to unit length', () => {
    const mean = meanDescriptor([[0, 2, 4], [2, 2, 2], [4, 2, 0]]);
    expect(mean).toEqual([2, 2, 2]);
    // The server compares by Euclidean distance on raw descriptors, so the template keeps the raw scale.
    expect(Math.hypot(...meanDescriptor([[3, 0], [3, 0]]))).toBe(3);
  });

  it('refuses nothing to average, or descriptors of different sizes', () => {
    expect(() => meanDescriptor([])).toThrow();
    expect(() => meanDescriptor([[1, 2], [1]])).toThrow();
  });
});

describe('addCapture', () => {
  const accept = (progress: EnrollmentProgress, descriptor: number[]) => {
    const result = addCapture(progress, descriptor);
    if (result.kind !== 'accepted') throw new Error(`expected accepted, got ${result.kind}`);
    return result.progress;
  };

  it('takes the first capture without anything to compare against', () => {
    expect(addCapture(EMPTY_PROGRESS, flat(1))).toEqual({ kind: 'accepted', progress: { captures: [flat(1)], rejections: 0 } });
  });

  it('completes with the mean after the required number of consistent captures', () => {
    expect(ENROLLMENT_CAPTURES).toBe(3);
    const second = accept(EMPTY_PROGRESS, flat(0.25));
    const third = accept(second, flat(0.26));
    const result = addCapture(third, flat(0.27));
    expect(result.kind).toBe('complete');
    if (result.kind !== 'complete') return;
    expect(result.descriptor).toHaveLength(128);
    expect(result.descriptor[0]).toBeCloseTo(0.26);
  });

  it('rejects a capture too far from any of the others and keeps the progress', () => {
    const progress = accept(EMPTY_PROGRESS, flat(0));
    const result = addCapture(progress, away(MAX_CAPTURE_DISTANCE + 0.1));
    expect(result).toEqual({ kind: 'rejected', progress: { captures: [flat(0)], rejections: 1 } });
    expect(addCapture(progress, away(MAX_CAPTURE_DISTANCE - 0.1)).kind).toBe('accepted');
  });

  it('compares with every earlier capture, not only the mean', () => {
    // The first two are 0.3 apart (fine); the candidate is close to the second but 0.6 from the first.
    const progress = accept(accept(EMPTY_PROGRESS, flat(0)), away(0.3));
    const candidate = away(0.6);
    expect(descriptorDistance(progress.captures[1]!, candidate)).toBeLessThan(MAX_CAPTURE_DISTANCE);
    expect(addCapture(progress, candidate).kind).toBe('rejected');
  });

  it('starts over after too many inconsistent captures in a row, and a good one clears the count', () => {
    let progress = accept(EMPTY_PROGRESS, flat(0));
    for (let i = 1; i < MAX_CONSECUTIVE_REJECTIONS; i += 1) {
      const result = addCapture(progress, away(1));
      expect(result.kind).toBe('rejected');
      if (result.kind === 'rejected') progress = result.progress;
    }
    expect(addCapture(progress, away(1))).toEqual({ kind: 'restarted', progress: EMPTY_PROGRESS });

    const cleared = accept(progress, away(0.1));
    expect(cleared.rejections).toBe(0);
  });
});
