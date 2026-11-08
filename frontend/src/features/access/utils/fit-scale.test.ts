import { describe, expect, it } from 'vitest';
import { fitScale, STAGE_HEIGHT, STAGE_WIDTH } from './fit-scale';

describe('fitScale', () => {
  it('uses the reference stage size of the approved design', () => {
    expect([STAGE_WIDTH, STAGE_HEIGHT]).toEqual([1180, 700]);
  });

  it('is 1 when the viewport is exactly the stage', () => {
    expect(fitScale(1180, 700)).toBe(1);
  });

  it('scales up on a larger screen, limited by the tighter side', () => {
    expect(fitScale(2360, 2000)).toBe(2);
    expect(fitScale(3000, 1400)).toBe(2);
  });

  it('scales down on a smaller screen, limited by the tighter side', () => {
    expect(fitScale(590, 2000)).toBe(0.5);
    expect(fitScale(2000, 350)).toBe(0.5);
  });

  it('never returns zero or a negative number for an empty viewport', () => {
    expect(fitScale(0, 0)).toBeGreaterThan(0);
    expect(fitScale(-5, 100)).toBeGreaterThan(0);
  });
});
