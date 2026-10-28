import type { PaymentMethod } from '../../payments/types/payment';
import type { IncomeConcept } from '../../reports/types/report';

/** Mirrors `CashCountExpected` in backend/src/modules/cashcount/cashcount.types.ts. */
export interface CashCountExpected {
  total: number;
  /** The cash part of `total`, which the counted cash is compared against. */
  cash: number;
  byMethod: Array<{ method: PaymentMethod; total: number }>;
  byConcept: Array<{ concept: IncomeConcept; total: number }>;
}

/** One closed day. Counted minus expected cash: negative is a shortage. */
export interface CashCount {
  id: string;
  businessDate: string;
  expected: CashCountExpected;
  countedCash: number;
  variance: number;
  varianceNote?: string;
  closedBy: string;
  closedAt: string;
}

export interface CashCountPreview {
  businessDate: string;
  expected: CashCountExpected;
  closed?: CashCount;
}

export interface CloseDayInput {
  countedCash: number;
  varianceNote?: string;
}
