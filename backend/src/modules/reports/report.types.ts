import type { ChargeLineKind, ClubDate } from '../payments/charge.types.js';
import type { PaymentMethod } from '../payments/payment.types.js';
import type { Money, Period } from '../payments/pricing.types.js';

export const REPORT_GRANULARITIES = ['daily', 'weekly', 'monthly'] as const;
export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];

export type IncomeConcept = ChargeLineKind;

/**
 * One amount of income as reports see it, whatever stored it. Reports read only this shape, so a future
 * source (for example expenses) plugs in through the same kind of port without touching the report DTOs.
 */
export interface IncomeEntry {
  receiptNumber: number;
  /** Club-local date the money was taken. */
  date: ClubDate;
  method: PaymentMethod;
  memberId: string;
  concept: IncomeConcept;
  /** The month the amount is for, which can differ from the month it was paid. */
  period: Period;
  disciplineId?: string;
  amount: Money;
  annulled: boolean;
}

export interface IncomeSource {
  list(): Promise<IncomeEntry[]>;
}

export interface RevenueQuery {
  granularity: ReportGranularity;
  /** Any club-local date inside the day, week (Monday to Sunday) or month to report. */
  date: ClubDate;
}

export interface RevenueReport {
  granularity: ReportGranularity;
  from: ClubDate;
  to: ClubDate;
  /** Valid (not annulled) income; the concept, method and receipt figures below each add up to it. */
  total: Money;
  byConcept: Array<{ concept: IncomeConcept; total: Money }>;
  /** Receipt lines per concept, for the printed report. Kept apart from `byConcept`, which the Arqueo stores as a snapshot. */
  operationsByConcept: Array<{ concept: IncomeConcept; count: number }>;
  byMethod: Array<{ method: PaymentMethod; total: Money }>;
  receipts: Array<{
    receiptNumber: number;
    date: ClubDate;
    method: PaymentMethod;
    total: Money;
    /** The concepts the receipt charged, in the order the reports list them. */
    concepts: IncomeConcept[];
    /** Absent when the member no longer exists in the list; never guessed. */
    member?: { memberNumber: string; fullName: string };
  }>;
  /** Annulled payments of the range, shown apart and never netted into the figures above. */
  annulled: { count: number; total: Money };
  /** Receipt numbers handed out in the range, annulled ones included; `null` when none were. */
  issued: { first: number; last: number; count: number } | null;
}

export interface DisciplineSettlementQuery {
  period: Period;
  disciplineId: string;
}

export interface DisciplineSettlement {
  period: Period;
  discipline: { id: string; name: string };
  /** Name, member number and month only: the club decided the list never shows the DNI. */
  students: Array<{ memberNumber: string; fullName: string; period: Period }>;
  feeTotal: Money;
  /** Late-payment surcharges linked to the discipline, kept out of `feeTotal`. */
  surchargeTotal: Money;
}
