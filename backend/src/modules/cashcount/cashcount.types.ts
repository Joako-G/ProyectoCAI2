import type { ClubDate } from '../payments/charge.types.js';
import type { Money } from '../payments/pricing.types.js';
import type { RevenueReport } from '../reports/report.types.js';

/** What the system expected to have taken on the day, frozen when the day is closed. */
export interface CashCountExpected {
  total: Money;
  /** The cash part of `total`: the amount the counted cash is compared against. */
  cash: Money;
  byMethod: RevenueReport['byMethod'];
  byConcept: RevenueReport['byConcept'];
}

/**
 * One closed day (Arqueo). Closes are append-only (RNF-08): there is no edit or delete, and the expected
 * totals are a snapshot, so later annulments never rewrite what was counted that day.
 */
export interface CashCount {
  id: string;
  /** Club-local date closed; at most one close exists per date. */
  businessDate: ClubDate;
  expected: CashCountExpected;
  /** Physical cash counted, a non-negative whole number. */
  countedCash: Money;
  /** Counted minus expected cash: negative is a shortage. Recorded and reviewed, never charged to a person. */
  variance: Money;
  /** Why the counts differ, when the person closing the day gave a reason. */
  varianceNote?: string;
  closedBy: string;
  /** ISO instant. */
  closedAt: string;
}

export interface CloseDayInput {
  countedCash: number;
  varianceNote?: string;
}

export interface CashCountPreview {
  businessDate: ClubDate;
  expected: CashCountExpected;
  /** The close of this day, once it exists. */
  closed?: CashCount;
}
