import { describe, expect, it } from 'vitest';
import { toIsoDate } from '../../src/shared/date.js';

describe('toIsoDate', () => {
  it('formats the instant as a club-calendar date', () => {
    expect(toIsoDate(new Date('2026-10-05T15:00:00Z'))).toBe('2026-10-05');
  });

  it('uses the club time zone, not UTC, near midnight', () => {
    expect(toIsoDate(new Date('2026-10-06T01:30:00Z'))).toBe('2026-10-05');
  });
});
