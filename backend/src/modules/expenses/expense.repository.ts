import type { Expense } from './expense.types.js';

export interface ExpenseRepository {
  // A missing file reads as no expenses.
  list(): Promise<Expense[]>;
  // Appends one expense as a single write.
  add(expense: Expense): Promise<void>;
}
