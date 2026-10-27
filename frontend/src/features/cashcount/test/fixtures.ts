import type { CashCount, CashCountExpected, CashCountPreview } from '../types/cashcount';

export function buildExpected(overrides: Partial<CashCountExpected> = {}): CashCountExpected {
  return {
    total: 4500,
    cash: 4000,
    byMethod: [{ method: 'cash', total: 4000 }, { method: 'qr', total: 500 }],
    byConcept: [{ concept: 'socialFee', total: 1500 }, { concept: 'activityFee', total: 3000 }],
    ...overrides,
  };
}

export function buildCashCount(overrides: Partial<CashCount> = {}): CashCount {
  return {
    id: 'close-1',
    businessDate: '2026-10-04',
    expected: buildExpected({ total: 2000, cash: 2000, byMethod: [{ method: 'cash', total: 2000 }], byConcept: [{ concept: 'socialFee', total: 2000 }] }),
    countedCash: 1900,
    variance: -100,
    varianceNote: 'Vuelto mal dado',
    closedBy: 'user-head',
    closedAt: '2026-10-04T21:00:00.000Z',
    ...overrides,
  };
}

export function buildPreview(overrides: Partial<CashCountPreview> = {}): CashCountPreview {
  return { businessDate: '2026-10-05', expected: buildExpected(), ...overrides };
}
