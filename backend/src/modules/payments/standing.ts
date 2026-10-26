import { ValidationError } from '../../shared/errors.js';

/** More than this many unpaid months means the member is deregistered (docs/team-handoff.md). */
export const DEFAULT_DEREGISTRATION_THRESHOLD = 3;

function assertCount(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError({ [field]: 'Must be a non-negative whole number' });
  }
}

export function isDeregistered(
  unpaidPeriodCount: number,
  threshold: number = DEFAULT_DEREGISTRATION_THRESHOLD,
): boolean {
  assertCount(unpaidPeriodCount, 'unpaidPeriodCount');
  assertCount(threshold, 'threshold');
  return unpaidPeriodCount > threshold;
}
