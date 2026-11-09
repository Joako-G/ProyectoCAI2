import { createJsonStore } from '../../database/json-store.js';
import type { ExpenseRepository } from './expense.repository.js';
import { EXPENSE_CATEGORIES, type Expense } from './expense.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWellShaped(value: unknown): value is Expense {
  return (
    isRecord(value) &&
    ['id', 'date', 'description', 'createdBy', 'createdAt'].every((field) => typeof value[field] === 'string') &&
    Number.isSafeInteger(value.amount) &&
    (value.amount as number) > 0 &&
    EXPENSE_CATEGORIES.includes(value.category as never)
  );
}

export function createJsonExpenseRepository(filePath: string): ExpenseRepository {
  const store = createJsonStore<Expense[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a write: saving it back would destroy the file.
  function assertExpenses(value: unknown): Expense[] {
    if (!Array.isArray(value) || !value.every(isWellShaped)) {
      throw new Error(`Invalid expenses file ${filePath}: it must contain a JSON array of expenses`);
    }
    return value;
  }

  return {
    list: async () => assertExpenses(await store.read()),
    async add(expense) {
      await store.update((current) => [...assertExpenses(current), expense]);
    },
  };
}
