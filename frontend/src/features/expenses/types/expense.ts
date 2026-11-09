/** Mirrors `EXPENSE_CATEGORIES` in backend/src/modules/expenses/expense.types.ts. */
export const EXPENSE_CATEGORIES = ['services', 'maintenance', 'supplies', 'salaries', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Mirrors `Expense` in backend/src/modules/expenses/expense.types.ts. */
export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface ExpenseInput {
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
}
