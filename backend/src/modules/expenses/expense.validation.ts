import { ValidationError } from '../../shared/errors.js';
import { EXPENSE_CATEGORIES, type CreateExpenseInput, type ExpenseCategory, type ExpenseQuery } from './expense.types.js';

export const MAX_DESCRIPTION_LENGTH = 200;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function parseDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isRealDate(value)) throw new ValidationError({ [field]: 'Must be a date as YYYY-MM-DD' });
  return value;
}

/** Shape check of a create body. Whether the date is in the future is the service's decision: it owns the clock. */
export function parseCreateBody(body: unknown): CreateExpenseInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError({ body: 'Must be a JSON object' });
  }
  const { date, amount, category, description } = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  if (typeof date !== 'string' || !isRealDate(date)) errors.date = 'Must be a date as YYYY-MM-DD';
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) errors.amount = 'Must be a positive whole number';
  if (typeof category !== 'string' || !EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) {
    errors.category = `Must be one of: ${EXPENSE_CATEGORIES.join(', ')}`;
  }
  const text = typeof description === 'string' ? description.trim() : '';
  if (text === '' || text.length > MAX_DESCRIPTION_LENGTH) errors.description = `Required, at most ${MAX_DESCRIPTION_LENGTH} characters`;

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { date: date as string, amount: amount as number, category: category as ExpenseCategory, description: text };
}

/** `from` and `to` are optional inclusive dates; query values that are not text are ignored by Express as arrays and rejected here. */
export function parseQuery(query: Record<string, unknown>): ExpenseQuery {
  const result: ExpenseQuery = {};
  if (query.from !== undefined) result.from = parseDate(query.from, 'from');
  if (query.to !== undefined) result.to = parseDate(query.to, 'to');
  if (result.from && result.to && result.from > result.to) throw new ValidationError({ to: 'Must not be before from' });
  return result;
}
