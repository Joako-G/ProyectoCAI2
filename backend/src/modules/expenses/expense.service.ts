import { randomUUID } from 'node:crypto';
import { toIsoDate } from '../../shared/date.js';
import { ValidationError } from '../../shared/errors.js';
import type { AuditRecorder } from '../audit/audit.service.js';
import type { ExpenseRepository } from './expense.repository.js';
import type { CreateExpenseInput, Expense, ExpenseQuery } from './expense.types.js';

export interface ExpenseServiceDeps {
  repository: ExpenseRepository;
  audit: AuditRecorder;
  now?: () => Date;
}

export function createExpenseService({ repository, audit, now = () => new Date() }: ExpenseServiceDeps) {
  return {
    // Newest first; `from` and `to` are inclusive club-local dates.
    async list(query: ExpenseQuery = {}): Promise<Expense[]> {
      return (await repository.list())
        .filter((expense) => (!query.from || expense.date >= query.from) && (!query.to || expense.date <= query.to))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    },

    // The actor and the time are decided here, never by the caller. The input is already shape-checked.
    async create(input: CreateExpenseInput, actorId: string): Promise<Expense> {
      if (typeof actorId !== 'string' || actorId.trim() === '') throw new ValidationError({ actorId: 'Required' });
      const instant = now();
      // PROVISIONAL(E3): an expense cannot be dated in the future; a past date is allowed so a late entry can be recorded.
      if (input.date > toIsoDate(instant)) throw new ValidationError({ date: 'Must not be in the future' });
      const expense: Expense = {
        id: randomUUID(),
        date: input.date,
        amount: input.amount,
        category: input.category,
        description: input.description,
        createdBy: actorId,
        createdAt: instant.toISOString(),
      };
      await repository.add(expense);
      await audit.record({ actorId, action: 'create', entityType: 'expense', entityId: expense.id });
      return expense;
    },
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
