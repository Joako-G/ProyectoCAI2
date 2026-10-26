import type { Payment } from './payment.types.js';

export interface PaymentMutation<R> {
  payments: Payment[];
  result: R;
}

export interface PaymentRepository {
  // A missing file reads as no payments.
  list(): Promise<Payment[]>;
  // Runs read-check-write as one unit; throwing inside `change` aborts without writing.
  mutate<R>(change: (payments: Payment[]) => PaymentMutation<R>): Promise<R>;
}
