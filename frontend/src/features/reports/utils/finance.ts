import type { Expense, ExpenseCategory } from '../../expenses/types/expense';
import type { DebtNotice } from '../../notices/types/notice';
import type { PaymentMethod } from '../../payments/types/payment';
import type { IncomeConcept, RevenueReport } from '../types/report';

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export interface RevenueTotals {
  total: number;
  byConcept: Array<{ concept: IncomeConcept; total: number }>;
  byMethod: Array<{ method: PaymentMethod; total: number }>;
  annulled: { count: number; total: number };
}

/** Adds up the monthly revenue reports of a range; concepts and methods come out biggest first. */
export function aggregateRevenue(reports: readonly RevenueReport[]): RevenueTotals {
  const concepts = new Map<IncomeConcept, number>();
  const methods = new Map<PaymentMethod, number>();
  for (const report of reports) {
    for (const { concept, total } of report.byConcept) concepts.set(concept, (concepts.get(concept) ?? 0) + total);
    for (const { method, total } of report.byMethod) methods.set(method, (methods.get(method) ?? 0) + total);
  }
  const biggest = <K>(map: Map<K, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total: sum(reports.map((report) => report.total)),
    byConcept: biggest(concepts).map(([concept, total]) => ({ concept, total })),
    byMethod: biggest(methods).map(([method, total]) => ({ method, total })),
    annulled: { count: sum(reports.map((report) => report.annulled.count)), total: sum(reports.map((report) => report.annulled.total)) },
  };
}

/** The expenses dated inside any of the given `YYYY-MM` months. */
export function expensesInMonths(expenses: readonly Expense[], months: readonly string[]): Expense[] {
  return expenses.filter(({ date }) => months.includes(date.slice(0, 7)));
}

/** Spending per category, biggest first; a category with no spending is left out. */
export function expensesByCategory(expenses: readonly Expense[]): Array<{ category: ExpenseCategory; total: number }> {
  const totals = new Map<ExpenseCategory, number>();
  for (const { category, amount } of expenses) totals.set(category, (totals.get(category) ?? 0) + amount);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total }));
}

/** Spending per month, in the order of `months`. */
export function expensesByMonth(expenses: readonly Expense[], months: readonly string[]): number[] {
  return months.map((month) => sum(expenses.filter(({ date }) => date.startsWith(month)).map(({ amount }) => amount)));
}

export interface CollectionSummary {
  active: number;
  upToDate: number;
  debtors: number;
  deregistered: number;
  /** Pesos owed by every member with debt, as of the list date. */
  owed: number;
  /** Share of the active members with nothing owed, in percent; `undefined` without active members. */
  collectionRate: number | undefined;
  /** Members with debt by number of unpaid months. */
  byMonths: Array<{ label: string; count: number }>;
  /** The members who owe the most. */
  top: DebtNotice[];
}

const TOP_DEBTORS = 5;

/** Where the collection stands today: who is up to date, who owes and for how long. */
export function collectionSummary(rows: readonly DebtNotice[], activeMembers: number): CollectionSummary {
  const deregistered = rows.filter(({ standing }) => standing === 'deregistered').length;
  const upToDate = Math.max(0, activeMembers - rows.length);
  const bucket = (label: string, test: (months: number) => boolean) => ({ label, count: rows.filter(({ unpaidPeriodCount }) => test(unpaidPeriodCount)).length });
  return {
    active: activeMembers,
    upToDate,
    debtors: rows.length - deregistered,
    deregistered,
    owed: sum(rows.map(({ total }) => total)),
    collectionRate: activeMembers > 0 ? (upToDate / activeMembers) * 100 : undefined,
    byMonths: [bucket('1 mes', (months) => months === 1), bucket('2 meses', (months) => months === 2), bucket('3 meses', (months) => months === 3), bucket('4 o más', (months) => months >= 4)],
    top: [...rows].sort((a, b) => b.total - a.total).slice(0, TOP_DEBTORS),
  };
}
