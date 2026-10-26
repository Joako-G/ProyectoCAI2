import { createJsonStore } from '../../database/json-store.js';
import type { PaymentRepository } from './payment.repository.js';
import { PAYMENT_METHODS, type Payment } from './payment.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const LINE_KINDS = ['enrollment', 'socialFee', 'activityFee', 'activitySurcharge', 'carnetReplacement'];
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isWellShapedLine(line: Record<string, unknown>): boolean {
  if (!LINE_KINDS.includes(line.kind as string)) return false;
  if (typeof line.period !== 'string' || !PERIOD_PATTERN.test(line.period)) return false;
  if (!Number.isSafeInteger(line.amount) || (line.amount as number) < 0) return false;
  const needsDiscipline = line.kind === 'activityFee' || line.kind === 'activitySurcharge';
  return !needsDiscipline || (typeof line.disciplineId === 'string' && line.disciplineId !== '');
}

function isWellShaped(value: unknown): value is Payment {
  if (!isRecord(value)) return false;
  const textFields = ['id', 'memberId', 'paymentDate', 'createdBy', 'createdAt'];
  if (!textFields.every((field) => typeof value[field] === 'string')) return false;
  if (!Number.isSafeInteger(value.receiptNumber) || (value.receiptNumber as number) < 1) return false;
  if (!Number.isSafeInteger(value.total)) return false;
  if (!PAYMENT_METHODS.includes(value.method as never)) return false;
  if (!Array.isArray(value.lines) || !value.lines.every((line) => isRecord(line) && isWellShapedLine(line))) return false;
  if (value.annulment === undefined) return true;
  const { annulment } = value;
  return (
    isRecord(annulment) &&
    typeof annulment.reason === 'string' &&
    typeof annulment.annulledBy === 'string' &&
    typeof annulment.annulledAt === 'string'
  );
}

export function createJsonPaymentRepository(filePath: string): PaymentRepository {
  const store = createJsonStore<Payment[]>(filePath, []);

  // A parsed-but-wrong shape must never reach a mutation: writing back would destroy the file.
  function assertPayments(value: unknown): Payment[] {
    if (!Array.isArray(value) || !value.every(isWellShaped)) {
      throw new Error(`Invalid payments file ${filePath}: it must contain a JSON array of payments`);
    }
    return value;
  }

  return {
    list: async () => assertPayments(await store.read()),
    async mutate(change) {
      let result!: ReturnType<typeof change>['result'];
      await store.update((current) => {
        const outcome = change(assertPayments(current));
        result = outcome.result;
        return outcome.payments;
      });
      return result;
    },
  };
}
