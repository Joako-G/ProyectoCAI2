import { createJsonStore } from '../../database/json-store.js';
import { CHARGE_LINE_KINDS } from '../payments/charge.types.js';
import { PAYMENT_METHODS } from '../payments/payment.types.js';
import type { CashCountRepository } from './cashcount.repository.js';
import type { CashCount } from './cashcount.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isMoney = (value: unknown) => Number.isSafeInteger(value);

function isRows(value: unknown, key: string, kinds: readonly string[]): boolean {
  return Array.isArray(value) && value.every((row) => isRecord(row) && kinds.includes(row[key] as string) && isMoney(row.total));
}

function isWellShaped(value: unknown): value is CashCount {
  if (!isRecord(value)) return false;
  if (!['id', 'businessDate', 'closedBy', 'closedAt'].every((field) => typeof value[field] === 'string')) return false;
  if (!isMoney(value.countedCash) || (value.countedCash as number) < 0 || !isMoney(value.variance)) return false;
  if (value.varianceNote !== undefined && typeof value.varianceNote !== 'string') return false;
  const { expected } = value;
  return (
    isRecord(expected) &&
    isMoney(expected.total) &&
    isMoney(expected.cash) &&
    isRows(expected.byMethod, 'method', PAYMENT_METHODS) &&
    isRows(expected.byConcept, 'concept', CHARGE_LINE_KINDS)
  );
}

export function createJsonCashCountRepository(filePath: string): CashCountRepository {
  const store = createJsonStore<CashCount[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function assertCashCounts(value: unknown): CashCount[] {
    if (!Array.isArray(value) || !value.every(isWellShaped)) {
      throw new Error(`Invalid cash counts file ${filePath}: it must contain a JSON array of cash counts`);
    }
    return value;
  }

  return {
    list: async () => assertCashCounts(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(assertCashCounts(current));
        result = outcome.result;
        return outcome.cashCounts;
      });
      return result;
    },
  };
}
