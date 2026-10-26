import { describe, expect, it } from 'vitest';
import { accountStanding, owedConcepts } from '../../src/modules/payments/account.js';
import type { ChargeLine } from '../../src/modules/payments/charge.types.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';

const ACTIVE = { id: 'm1', status: 'active' as const };

function membership(disciplineId: string, startDate: string, endDate?: string, memberId = 'm1'): Membership {
  return {
    id: `${memberId}-${disciplineId}-${startDate}`,
    memberId,
    disciplineId,
    startDate,
    status: endDate ? 'ended' : 'active',
    ...(endDate ? { endDate } : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function payment(lines: ChargeLine[], overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p1',
    receiptNumber: 1,
    memberId: 'm1',
    method: 'cash',
    paymentDate: '2026-10-05',
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    createdBy: 'u1',
    createdAt: '2026-10-05T12:00:00.000Z',
    ...overrides,
  };
}

const base = { member: ACTIVE, payments: [] as Payment[], firstPeriod: '2026-01', asOf: '2026-10-05' };

describe('owedConcepts', () => {
  it('owes one social fee per month and one activity fee per active discipline', () => {
    const owed = owedConcepts({
      ...base,
      firstPeriod: '2026-09',
      memberships: [membership('basket', '2026-09-01'), membership('volley', '2026-10-02')],
    });
    expect(owed).toEqual([
      {
        period: '2026-09',
        concepts: [
          { kind: 'socialFee', period: '2026-09' },
          { kind: 'activityFee', period: '2026-09', disciplineId: 'basket' },
        ],
      },
      {
        period: '2026-10',
        concepts: [
          { kind: 'socialFee', period: '2026-10' },
          { kind: 'activityFee', period: '2026-10', disciplineId: 'basket' },
          { kind: 'activityFee', period: '2026-10', disciplineId: 'volley' },
        ],
      },
    ]);
  });

  it('follows a discipline added and another removed mid-history, skipping months with none', () => {
    const owed = owedConcepts({
      ...base,
      firstPeriod: '2026-06',
      memberships: [membership('basket', '2026-06-10', '2026-07-15'), membership('volley', '2026-09-01')],
    });
    expect(owed.map((entry) => entry.period)).toEqual(['2026-06', '2026-07', '2026-09', '2026-10']);
    expect(owed[1]!.concepts).toEqual([
      { kind: 'socialFee', period: '2026-07' },
      { kind: 'activityFee', period: '2026-07', disciplineId: 'basket' },
    ]);
    expect(owed[2]!.concepts).toContainEqual({ kind: 'activityFee', period: '2026-09', disciplineId: 'volley' });
  });

  it('ignores other members memberships', () => {
    const owed = owedConcepts({ ...base, memberships: [membership('basket', '2026-01-01', undefined, 'other')] });
    expect(owed).toEqual([]);
  });

  it('starts no earlier than the pricing floor', () => {
    const owed = owedConcepts({ ...base, firstPeriod: '2026-08', memberships: [membership('basket', '2025-11-01')] });
    expect(owed.map((entry) => entry.period)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('excludes months after the as-of month', () => {
    const owed = owedConcepts({ ...base, asOf: '2026-09-30', memberships: [membership('basket', '2026-08-01')] });
    expect(owed.map((entry) => entry.period)).toEqual(['2026-08', '2026-09']);
  });

  it('stops owing after the deactivation month of an inactive member', () => {
    const owed = owedConcepts({
      ...base,
      member: { id: 'm1', status: 'inactive', deactivation: { date: '2026-08-20' } },
      memberships: [membership('basket', '2026-06-01')],
    });
    expect(owed.map((entry) => entry.period)).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('does not cap a reactivated member that still carries an old deactivation', () => {
    const owed = owedConcepts({
      ...base,
      member: { id: 'm1', status: 'active', deactivation: { date: '2026-08-20' } },
      memberships: [membership('basket', '2026-08-01')],
    });
    expect(owed.map((entry) => entry.period)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('removes concepts settled by a payment and drops a month once all its concepts are paid', () => {
    const settled = payment([
      { kind: 'socialFee', period: '2026-09', amount: 20_000 },
      { kind: 'activityFee', period: '2026-09', disciplineId: 'basket', amount: 20_000 },
      { kind: 'activitySurcharge', period: '2026-09', disciplineId: 'basket', amount: 3_000 },
      { kind: 'socialFee', period: '2026-10', amount: 20_000 },
    ]);
    const owed = owedConcepts({
      ...base,
      firstPeriod: '2026-09',
      payments: [settled],
      memberships: [membership('basket', '2026-09-01')],
    });
    expect(owed).toEqual([
      { period: '2026-10', concepts: [{ kind: 'activityFee', period: '2026-10', disciplineId: 'basket' }] },
    ]);
  });

  it('keeps a concept owed when its payment was annulled or belongs to another member', () => {
    const lines: ChargeLine[] = [{ kind: 'socialFee', period: '2026-10', amount: 20_000 }];
    const annulled = payment(lines, {
      annulment: { reason: 'wrong member', annulledBy: 'u2', annulledAt: '2026-10-06T00:00:00.000Z' },
    });
    const foreign = payment(lines, { id: 'p2', receiptNumber: 2, memberId: 'other' });
    const owed = owedConcepts({
      ...base,
      payments: [annulled, foreign],
      memberships: [membership('basket', '2026-10-01')],
    });
    expect(owed[0]!.concepts).toContainEqual({ kind: 'socialFee', period: '2026-10' });
  });
});

describe('accountStanding', () => {
  const unpaidMonths = (count: number) =>
    Array.from({ length: count }, (_unused, index) => ({
      period: `2026-0${index + 1}`,
      concepts: [{ kind: 'socialFee' as const, period: `2026-0${index + 1}` }],
    }));

  it('moves from up to date to debtor to deregistered at the fourth unpaid month', () => {
    expect(accountStanding(unpaidMonths(0))).toBe('up_to_date');
    expect(accountStanding(unpaidMonths(1))).toBe('debtor');
    expect(accountStanding(unpaidMonths(3))).toBe('debtor');
    expect(accountStanding(unpaidMonths(4))).toBe('deregistered');
  });

  it('counts a month once however many concepts it holds', () => {
    const month = {
      period: '2026-01',
      concepts: [
        { kind: 'socialFee' as const, period: '2026-01' },
        { kind: 'activityFee' as const, period: '2026-01', disciplineId: 'a' },
        { kind: 'activityFee' as const, period: '2026-01', disciplineId: 'b' },
      ],
    };
    expect(accountStanding([month])).toBe('debtor');
  });
});
