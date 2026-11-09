import { request, sendJson } from '../../members/services/members-api';
import type { Expense, ExpenseInput } from '../types/expense';

export function fetchExpenses(signal?: AbortSignal): Promise<Expense[]> {
  return request<Expense[]>('/api/expenses', { signal });
}

/** Records an expense. The server decides the author and the time. */
export function createExpense(input: ExpenseInput): Promise<Expense> {
  return request<Expense>('/api/expenses', sendJson('POST', input));
}
