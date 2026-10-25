import { describe, expect, it } from 'vitest';
import { activeDisciplineIdsForPeriod } from '../../src/modules/memberships/membership.period.js';
import { ValidationError } from '../../src/shared/errors.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';

function membership(overrides: Partial<Membership>): Membership {
  return {
    id: 'm',
    memberId: 'member-1',
    disciplineId: 'disc-a',
    startDate: '2026-01-01',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ended = (startDate: string, endDate: string, disciplineId = 'disc-a') =>
  membership({ startDate, endDate, status: 'ended', disciplineId });

describe('activeDisciplineIdsForPeriod', () => {
  it('counts an open membership that started before the month', () => {
    expect(activeDisciplineIdsForPeriod([membership({})], 'member-1', '2026-10')).toEqual(['disc-a']);
  });

  it('counts a membership that started mid-month, and on the first and last day', () => {
    for (const startDate of ['2026-10-01', '2026-10-17', '2026-10-31']) {
      expect(activeDisciplineIdsForPeriod([membership({ startDate })], 'member-1', '2026-10')).toEqual(['disc-a']);
    }
  });

  it('excludes a membership that starts next month', () => {
    expect(activeDisciplineIdsForPeriod([membership({ startDate: '2026-11-01' })], 'member-1', '2026-10')).toEqual([]);
  });

  it('counts a membership that ended mid-month or on the first or last day of the month', () => {
    for (const endDate of ['2026-10-01', '2026-10-12', '2026-10-31']) {
      expect(activeDisciplineIdsForPeriod([ended('2026-01-01', endDate)], 'member-1', '2026-10')).toEqual(['disc-a']);
    }
  });

  it('excludes a membership that ended the previous month, including its last day', () => {
    expect(activeDisciplineIdsForPeriod([ended('2026-01-01', '2026-09-30')], 'member-1', '2026-10')).toEqual([]);
  });

  it('counts a membership that started and ended within the same month', () => {
    expect(activeDisciplineIdsForPeriod([ended('2026-10-05', '2026-10-05')], 'member-1', '2026-10')).toEqual(['disc-a']);
  });

  it('crosses year boundaries', () => {
    const records = [ended('2025-06-01', '2026-01-02')];
    expect(activeDisciplineIdsForPeriod(records, 'member-1', '2026-01')).toEqual(['disc-a']);
    expect(activeDisciplineIdsForPeriod(records, 'member-1', '2025-12')).toEqual(['disc-a']);
    expect(activeDisciplineIdsForPeriod(records, 'member-1', '2026-02')).toEqual([]);
    expect(activeDisciplineIdsForPeriod(records, 'member-1', '2025-05')).toEqual([]);
  });

  it('ignores other members, de-duplicates re-enrollments and sorts the ids', () => {
    const records = [
      ended('2026-01-01', '2026-10-03', 'disc-b'),
      membership({ id: 'again', startDate: '2026-10-10', disciplineId: 'disc-b' }),
      membership({ id: 'first', disciplineId: 'disc-a' }),
      membership({ id: 'other', memberId: 'member-2', disciplineId: 'disc-c' }),
    ];
    expect(activeDisciplineIdsForPeriod(records, 'member-1', '2026-10')).toEqual(['disc-a', 'disc-b']);
  });

  it.each(['2026-13', '2026-00', '2026-1', '2026-10-05', 'october', ''])('rejects the invalid period %j', (period) => {
    const error = (() => {
      try {
        activeDisciplineIdsForPeriod([], 'member-1', period);
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toEqual({ period: 'Period must be a valid month (YYYY-MM)' });
  });
});
