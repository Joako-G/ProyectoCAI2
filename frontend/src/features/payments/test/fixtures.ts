import type { Charge, MemberAccount, Payment } from '../types/payment';

/** A debtor owing the social and the Básquet fee for September and October 2026. */
export function buildAccount(overrides: Partial<MemberAccount> = {}): MemberAccount {
  return {
    memberId: 'member-1',
    asOf: '2026-10-26',
    standing: 'debtor',
    unpaidPeriodCount: 2,
    owed: [
      { period: '2026-09', concepts: [{ kind: 'socialFee', period: '2026-09' }, { kind: 'activityFee', period: '2026-09', disciplineId: 'disc-1' }] },
      { period: '2026-10', concepts: [{ kind: 'socialFee', period: '2026-10' }, { kind: 'activityFee', period: '2026-10', disciplineId: 'disc-1' }] },
    ],
    ...overrides,
  };
}

/** The charge for every concept of `buildAccount`, with a late surcharge on September's activity. */
export function buildCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    lines: [
      { kind: 'socialFee', period: '2026-09', amount: 15000 },
      { kind: 'activityFee', period: '2026-09', disciplineId: 'disc-1', amount: 18000 },
      { kind: 'activitySurcharge', period: '2026-09', disciplineId: 'disc-1', amount: 10000 },
      { kind: 'socialFee', period: '2026-10', amount: 15000 },
      { kind: 'activityFee', period: '2026-10', disciplineId: 'disc-1', amount: 18000 },
    ],
    total: 76000,
    ...overrides,
  };
}

export function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    receiptNumber: 7,
    memberId: 'member-1',
    method: 'cash',
    paymentDate: '2026-08-20',
    lines: [{ kind: 'socialFee', period: '2026-08', amount: 15000 }],
    total: 15000,
    createdBy: 'user-1',
    createdAt: '2026-08-20T15:00:00.000Z',
    ...overrides,
  };
}
