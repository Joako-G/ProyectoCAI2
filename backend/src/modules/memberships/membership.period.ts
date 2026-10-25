import { ValidationError } from '../../shared/errors.js';
import type { Membership } from './membership.types.js';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

// A membership counts for a month (YYYY-MM) when it was active on at least one day of it: it started
// on or before the month's last day and had not ended before the month's first day. Pure; no I/O.
// Returns the distinct discipline ids of the member, sorted.
export function activeDisciplineIdsForPeriod(
  memberships: readonly Membership[],
  memberId: string,
  period: string,
): string[] {
  if (!PERIOD.test(period)) throw new ValidationError({ period: 'Period must be a valid month (YYYY-MM)' });
  // Dates are zero-padded YYYY-MM-DD, so their first seven characters compare chronologically as months.
  const ids = memberships
    .filter(
      (membership) =>
        membership.memberId === memberId &&
        membership.startDate.slice(0, 7) <= period &&
        (membership.endDate === undefined || membership.endDate.slice(0, 7) >= period),
    )
    .map((membership) => membership.disciplineId);
  return [...new Set(ids)].sort();
}
