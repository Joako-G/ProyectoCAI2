import type { PaymentMethod } from '../../payments/types/payment';

export type ReportGranularity = 'daily' | 'weekly' | 'monthly';

export type IncomeConcept = 'enrollment' | 'socialFee' | 'activityFee' | 'activitySurcharge' | 'carnetReplacement';

/** Mirrors `RevenueReport` in backend/src/modules/reports/report.types.ts. */
export interface RevenueReport {
  granularity: ReportGranularity;
  from: string;
  to: string;
  total: number;
  byConcept: Array<{ concept: IncomeConcept; total: number }>;
  /** Receipt lines per concept. */
  operationsByConcept: Array<{ concept: IncomeConcept; count: number }>;
  byMethod: Array<{ method: PaymentMethod; total: number }>;
  receipts: Array<{
    receiptNumber: number;
    date: string;
    method: PaymentMethod;
    total: number;
    concepts: IncomeConcept[];
    /** Absent when the server could not find the member. */
    member?: { memberNumber: string; fullName: string };
  }>;
  annulled: { count: number; total: number };
  /** Receipt numbers issued in the range, annulled ones included. */
  issued: { first: number; last: number; count: number } | null;
}

/** Mirrors `DisciplineSettlement` in backend/src/modules/reports/report.types.ts. */
export interface DisciplineSettlement {
  period: string;
  discipline: { id: string; name: string };
  students: Array<{ memberNumber: string; fullName: string; period: string }>;
  feeTotal: number;
  surchargeTotal: number;
}
