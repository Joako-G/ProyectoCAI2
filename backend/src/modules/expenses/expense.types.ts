import type { ClubDate } from '../payments/charge.types.js';
import type { Money } from '../payments/pricing.types.js';

// PROVISIONAL(E1): no approved requirement defines club expenses (the RF list has none; the research report
// only mentions "gastos" in the RESUMEN sheet). This closed list is a minimum assumption to confirm with the club.
export const EXPENSE_CATEGORIES = ['services', 'maintenance', 'supplies', 'salaries', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * One expense of the club. Records are append-only (RNF-08): there is no edit, delete or annulment.
 * PROVISIONAL(E2): the fields below are the minimum assumed; payment method, receipt/invoice number and
 * supplier are not recorded until the club says it needs them.
 */
export interface Expense {
  id: string;
  /** Club-local date the money was spent. */
  date: ClubDate;
  /** A positive whole number, like every other amount in the system. */
  amount: Money;
  category: ExpenseCategory;
  description: string;
  createdBy: string;
  /** ISO instant. */
  createdAt: string;
}

export interface CreateExpenseInput {
  date: ClubDate;
  amount: number;
  category: ExpenseCategory;
  description: string;
}

export interface ExpenseQuery {
  from?: ClubDate;
  to?: ClubDate;
}
