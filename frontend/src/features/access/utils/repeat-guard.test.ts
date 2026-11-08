import { describe, expect, it } from 'vitest';
import { createRepeatGuard, descriptorDistance, SAME_PERSON_DISTANCE, SAME_PERSON_WINDOW_MS } from './repeat-guard';

const face = (value: number) => Array.from({ length: 128 }, () => value);
/** A descriptor at exactly `distance` from `face(0)`: the whole distance in the first position. */
const away = (distance: number) => [distance, ...face(0).slice(1)];

function setup() {
  let clock = 1_000_000;
  const guard = createRepeatGuard({ now: () => clock });
  return { guard, tick: (ms: number) => (clock += ms) };
}

describe('descriptorDistance', () => {
  it('is the Euclidean distance, and infinite when the descriptors cannot be compared', () => {
    expect(descriptorDistance(away(0.3), face(0))).toBeCloseTo(0.3, 10);
    expect(descriptorDistance(face(0), face(0))).toBe(0);
    expect(descriptorDistance([1, 2], [1])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('createRepeatGuard', () => {
  it('names its limits: about 0.4 apart and 30 seconds', () => {
    expect(SAME_PERSON_DISTANCE).toBe(0.4);
    expect(SAME_PERSON_WINDOW_MS).toBe(30_000);
  });

  it('lets the first face through, because nobody was recognized yet', () => {
    const { guard } = setup();
    expect(guard.isRepeat(face(0))).toBe(false);
  });

  it('skips the same person for 30 seconds after they were recognized', () => {
    const { guard, tick } = setup();
    guard.remember(face(0));
    expect(guard.isRepeat(away(0.2))).toBe(true);
    tick(SAME_PERSON_WINDOW_MS - 1);
    expect(guard.isRepeat(away(0.2))).toBe(true);
  });

  it('lets the same person through again once the window has passed', () => {
    const { guard, tick } = setup();
    guard.remember(face(0));
    tick(SAME_PERSON_WINDOW_MS);
    expect(guard.isRepeat(face(0))).toBe(false);
  });

  it('recognizes a different person at once, even inside the window', () => {
    const { guard } = setup();
    guard.remember(face(0));
    expect(guard.isRepeat(away(SAME_PERSON_DISTANCE))).toBe(false);
    expect(guard.isRepeat(away(0.9))).toBe(false);
  });

  it('only remembers the last person: the previous one is announced again', () => {
    const { guard } = setup();
    guard.remember(face(0));
    guard.remember(away(1));
    expect(guard.isRepeat(face(0))).toBe(false);
    expect(guard.isRepeat(away(1))).toBe(true);
  });

  it('restarts the window every time somebody is recognized', () => {
    const { guard, tick } = setup();
    guard.remember(face(0));
    tick(20_000);
    guard.remember(face(0));
    tick(20_000);
    expect(guard.isRepeat(face(0))).toBe(true);
  });
});
