import type { DisciplineSettlement, RevenueReport } from '../types/report';

export function buildRevenue(overrides: Partial<RevenueReport> = {}): RevenueReport {
  return {
    granularity: 'daily',
    from: '2026-10-05',
    to: '2026-10-05',
    total: 4500,
    byConcept: [{ concept: 'socialFee', total: 1500 }, { concept: 'activityFee', total: 3000 }],
    byMethod: [{ method: 'cash', total: 4000 }, { method: 'qr', total: 500 }],
    receipts: [
      { receiptNumber: 1, date: '2026-10-05', method: 'cash', total: 4000 },
      { receiptNumber: 2, date: '2026-10-05', method: 'qr', total: 500 },
    ],
    annulled: { count: 0, total: 0 },
    ...overrides,
  };
}

export function buildSettlement(overrides: Partial<DisciplineSettlement> = {}): DisciplineSettlement {
  return {
    period: '2026-10',
    discipline: { id: 'disc-1', name: 'Básquet' },
    students: [{ memberNumber: '0001', fullName: 'Lucía Ríos', period: '2026-10' }],
    feeTotal: 3000,
    surchargeTotal: 300,
    ...overrides,
  };
}
