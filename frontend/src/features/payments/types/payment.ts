// Mirrors the backend response shapes (backend/src/modules/payments/payment.types.ts and charge.types.ts).
/** A month as `YYYY-MM`. */
export type Period = string;

export type PaymentMethod = 'cash' | 'debit' | 'qr' | 'transfer';

/** One payable concept; the client never sends amounts, only what is being paid. */
export type ChargeConcept =
  | { kind: 'enrollment' }
  | { kind: 'socialFee'; period: Period }
  | { kind: 'activityFee'; period: Period; disciplineId: string }
  | { kind: 'carnetReplacement' };

export type OwedConcept = Extract<ChargeConcept, { kind: 'socialFee' | 'activityFee' }>;

export type ChargeLineKind = 'enrollment' | 'socialFee' | 'activityFee' | 'activitySurcharge' | 'carnetReplacement';

export interface ChargeLine {
  kind: ChargeLineKind;
  period: Period;
  disciplineId?: string;
  /** Whole pesos. */
  amount: number;
  prorated?: boolean;
}

export interface Charge {
  lines: ChargeLine[];
  total: number;
}

export interface PaymentAnnulment {
  reason: string;
  annulledBy: string;
  annulledAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: number;
  memberId: string;
  method: PaymentMethod;
  /** Club-local `YYYY-MM-DD`. */
  paymentDate: string;
  lines: ChargeLine[];
  total: number;
  createdBy: string;
  createdAt: string;
  annulment?: PaymentAnnulment;
}

export interface OwedPeriod {
  period: Period;
  concepts: OwedConcept[];
}

export type AccountStanding = 'up_to_date' | 'debtor' | 'deregistered';

export interface MemberAccount {
  memberId: string;
  asOf: string;
  standing: AccountStanding;
  unpaidPeriodCount: number;
  owed: OwedPeriod[];
}

/** Body of `POST /api/payments/preview`; `registration: {}` marks a first-time registration. */
export interface PreviewRequest {
  memberId: string;
  concepts: ChargeConcept[];
  registration?: Record<string, never>;
}

export interface RegisterRequest extends PreviewRequest {
  method: PaymentMethod;
}
