import { describe, expect, it } from 'vitest';
import type { Expense } from '../../expenses/types/expense';
import type { DebtNotice } from '../../notices/types/notice';
import { buildRevenue } from '../test/fixtures';
import { aggregateRevenue, collectionSummary, expensesByCategory, expensesByMonth, expensesInMonths } from './finance';

const expense = (date: string, amount: number, category: Expense['category'] = 'services'): Expense => ({ id: `${date}-${amount}`, date, amount, category, description: 'x', createdBy: 'u', createdAt: date });

const debt = (overrides: Partial<DebtNotice>): DebtNotice => ({
  memberId: 'm', memberNumber: '0001', name: 'Socio', standing: 'debtor', unpaidPeriodCount: 1, total: 1000,
  recipient: 'member', recipientName: 'Socio', recipientContact: '', link: null, numberIssue: true, ...overrides,
});

describe('aggregateRevenue', () => {
  it('adds the months up and orders concepts and methods biggest first', () => {
    const totals = aggregateRevenue([
      buildRevenue({ total: 4500, byConcept: [{ concept: 'socialFee', total: 1500 }, { concept: 'activityFee', total: 3000 }], byMethod: [{ method: 'cash', total: 4000 }, { method: 'qr', total: 500 }], annulled: { count: 1, total: 200 } }),
      buildRevenue({ total: 2000, byConcept: [{ concept: 'socialFee', total: 2000 }], byMethod: [{ method: 'qr', total: 2000 }], annulled: { count: 0, total: 0 } }),
    ]);

    expect(totals.total).toBe(6500);
    expect(totals.byConcept).toEqual([{ concept: 'socialFee', total: 3500 }, { concept: 'activityFee', total: 3000 }]);
    expect(totals.byMethod).toEqual([{ method: 'cash', total: 4000 }, { method: 'qr', total: 2500 }]);
    expect(totals.annulled).toEqual({ count: 1, total: 200 });
  });

  it('is empty without reports', () => {
    expect(aggregateRevenue([])).toEqual({ total: 0, byConcept: [], byMethod: [], annulled: { count: 0, total: 0 } });
  });
});

describe('expenses', () => {
  const all = [expense('2026-09-03', 300), expense('2026-10-01', 500, 'salaries'), expense('2026-10-20', 200, 'salaries'), expense('2026-08-31', 999)];

  it('keeps the expenses of the months asked for', () => {
    expect(expensesInMonths(all, ['2026-09', '2026-10'])).toHaveLength(3);
  });

  it('groups by category biggest first and by month in order', () => {
    const inRange = expensesInMonths(all, ['2026-09', '2026-10']);
    expect(expensesByCategory(inRange)).toEqual([{ category: 'salaries', total: 700 }, { category: 'services', total: 300 }]);
    expect(expensesByMonth(inRange, ['2026-09', '2026-10'])).toEqual([300, 700]);
  });
});

describe('collectionSummary', () => {
  const rows = [
    debt({ memberId: 'a', unpaidPeriodCount: 1, total: 3000 }),
    debt({ memberId: 'b', unpaidPeriodCount: 3, total: 12000 }),
    debt({ memberId: 'c', unpaidPeriodCount: 5, total: 30000, standing: 'deregistered' }),
  ];

  it('counts who is up to date, who owes and how long, and how much is owed', () => {
    const summary = collectionSummary(rows, 10);

    expect(summary).toMatchObject({ active: 10, upToDate: 7, debtors: 2, deregistered: 1, owed: 45000, collectionRate: 70 });
    expect(summary.byMonths).toEqual([{ label: '1 mes', count: 1 }, { label: '2 meses', count: 0 }, { label: '3 meses', count: 1 }, { label: '4 o más', count: 1 }]);
    expect(summary.top.map(({ memberId }) => memberId)).toEqual(['c', 'b', 'a']);
  });

  it('has no rate without active members and never counts a negative number up to date', () => {
    expect(collectionSummary([], 0).collectionRate).toBeUndefined();
    expect(collectionSummary(rows, 2).upToDate).toBe(0);
  });
});
