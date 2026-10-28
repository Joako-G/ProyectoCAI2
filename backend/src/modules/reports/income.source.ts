import type { PaymentRepository } from '../payments/payment.repository.js';
import type { IncomeSource } from './report.types.js';

/** Income entries from the payment receipts: one per receipt line, flagged when the payment was annulled. */
export function createPaymentIncomeSource(payments: Pick<PaymentRepository, 'list'>): IncomeSource {
  return {
    async list() {
      return (await payments.list()).flatMap((payment) =>
        payment.lines.map((line) => ({
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          method: payment.method,
          memberId: payment.memberId,
          concept: line.kind,
          period: line.period,
          ...(line.disciplineId ? { disciplineId: line.disciplineId } : {}),
          amount: line.amount,
          annulled: payment.annulment !== undefined,
        })),
      );
    },
  };
}
