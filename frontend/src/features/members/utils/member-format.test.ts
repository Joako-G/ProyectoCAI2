import { describe, expect, it } from 'vitest';
import { calculateAge, formatIsoDate, todayInClub } from './member-format';

describe('calculateAge', () => {
  it('counts full years', () => {
    expect(calculateAge('1990-03-15', '2026-10-05')).toBe(36);
  });

  it('does not count the year until the birthday has been reached', () => {
    expect(calculateAge('1990-10-06', '2026-10-05')).toBe(35);
    expect(calculateAge('1990-10-05', '2026-10-05')).toBe(36);
  });

  it('is zero in the first year of life', () => {
    expect(calculateAge('2026-01-01', '2026-10-05')).toBe(0);
  });

  it('counts a Feb 29 birthday as March 1 in non-leap years', () => {
    expect(calculateAge('2000-02-29', '2027-02-28')).toBe(26);
    expect(calculateAge('2000-02-29', '2027-03-01')).toBe(27);
    expect(calculateAge('2000-02-29', '2028-02-29')).toBe(28);
  });
});

describe('todayInClub', () => {
  it('uses the club time zone calendar day, not the UTC one', () => {
    // 01:00 UTC on Oct 6 is still Oct 5 in Argentina (UTC-3).
    expect(todayInClub(new Date('2026-10-06T01:00:00Z'))).toBe('2026-10-05');
    expect(todayInClub(new Date('2026-10-06T04:00:00Z'))).toBe('2026-10-06');
  });
});

describe('formatIsoDate', () => {
  it('renders day/month/year without time zone shifts', () => {
    expect(formatIsoDate('2015-02-01')).toBe('01/02/2015');
  });
});
