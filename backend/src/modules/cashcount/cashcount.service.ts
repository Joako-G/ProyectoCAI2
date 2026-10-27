import { randomUUID } from 'node:crypto';
import { toIsoDate } from '../../shared/date.js';
import { ConflictError, ValidationError } from '../../shared/errors.js';
import type { RevenueQuery, RevenueReport } from '../reports/report.types.js';
import type { CashCountRepository } from './cashcount.repository.js';
import type { CashCount, CashCountExpected, CashCountPreview, CloseDayInput } from './cashcount.types.js';

const MAX_NOTE_LENGTH = 500;

// The day's expected totals come from the revenue report, so the Arqueo and the Reports can never disagree.
export interface CashCountServiceDeps {
  repository: CashCountRepository;
  revenue: { revenue(query: RevenueQuery): Promise<RevenueReport> };
  now?: () => Date;
}

function requireCountedCash(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError({ countedCash: 'Must be a non-negative whole number' });
  }
  return value;
}

// An empty note means no reason was given.
function optionalNote(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError({ varianceNote: 'Must be text' });
  const note = value.trim();
  if (note.length > MAX_NOTE_LENGTH) throw new ValidationError({ varianceNote: `Must be at most ${MAX_NOTE_LENGTH} characters` });
  return note === '' ? undefined : note;
}

function expectedFrom(report: RevenueReport): CashCountExpected {
  return {
    total: report.total,
    cash: report.byMethod.find((row) => row.method === 'cash')?.total ?? 0,
    byMethod: report.byMethod,
    byConcept: report.byConcept,
  };
}

export function createCashCountService({ repository, revenue, now = () => new Date() }: CashCountServiceDeps) {
  const today = () => toIsoDate(now());
  const expectedFor = async (businessDate: string) => expectedFrom(await revenue.revenue({ granularity: 'daily', date: businessDate }));

  return {
    // What is expected today and the close of today, if any. Writes nothing.
    async preview(): Promise<CashCountPreview> {
      const businessDate = today();
      const [expected, closes] = await Promise.all([expectedFor(businessDate), repository.list()]);
      const closed = closes.find((close) => close.businessDate === businessDate);
      return { businessDate, expected, ...(closed ? { closed } : {}) };
    },

    // Closes today. The date, actor, time, expected totals and variance are all decided here, never by the caller.
    async close(input: CloseDayInput, actorId: string): Promise<CashCount> {
      const countedCash = requireCountedCash(input?.countedCash);
      const varianceNote = optionalNote(input?.varianceNote);
      if (typeof actorId !== 'string' || actorId.trim() === '') throw new ValidationError({ actorId: 'Required' });
      const businessDate = today();
      const expected = await expectedFor(businessDate);
      return repository.mutate((closes) => {
        // One close per day, checked in the same write that stores it, so a retry or a race cannot add a second.
        if (closes.some((close) => close.businessDate === businessDate)) {
          throw new ConflictError(`The day ${businessDate} is already closed`);
        }
        const close: CashCount = {
          id: randomUUID(),
          businessDate,
          expected,
          countedCash,
          variance: countedCash - expected.cash,
          ...(varianceNote ? { varianceNote } : {}),
          closedBy: actorId,
          closedAt: now().toISOString(),
        };
        return { cashCounts: [...closes, close], result: close };
      });
    },

    // Every close, newest day first.
    async history(): Promise<CashCount[]> {
      return (await repository.list()).sort((a, b) => b.businessDate.localeCompare(a.businessDate));
    },
  };
}

export type CashCountService = ReturnType<typeof createCashCountService>;
