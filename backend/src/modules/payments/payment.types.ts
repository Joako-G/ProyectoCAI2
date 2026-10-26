import type { ChargeConcept, ChargeLine, ClubDate, FirstTimeRegistration } from './charge.types.js';
import type { Period } from './pricing.types.js';

export const PAYMENT_METHODS = ['cash', 'debit', 'qr', 'transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Recorded on the payment when it is annulled. The payment itself is never deleted (RNF-08). */
export interface PaymentAnnulment {
  reason: string;
  annulledBy: string;
  /** ISO instant. */
  annulledAt: string;
}

/**
 * One receipt. `lines` and `total` are a snapshot of what was charged, so later tariff or rule
 * changes never alter it. An annulled payment keeps its receipt number but no longer settles anything.
 */
export interface Payment {
  id: string;
  /** Correlative integer, allocated in the same repository write as the payment, never reused. */
  receiptNumber: number;
  memberId: string;
  method: PaymentMethod;
  /** Club-local date the payment was taken; drives the surcharge tier. */
  paymentDate: ClubDate;
  lines: ChargeLine[];
  total: number;
  registration?: FirstTimeRegistration;
  createdBy: string;
  /** ISO instant. */
  createdAt: string;
  /** Client-generated idempotency key of the registration; absent on payments stored before it existed. */
  requestId?: string;
  annulment?: PaymentAnnulment;
}

/** A month with at least one unpaid concept. Only social and activity fees are derived as owed. */
export interface OwedPeriod {
  period: Period;
  concepts: Array<Extract<ChargeConcept, { kind: 'socialFee' | 'activityFee' }>>;
}

export type AccountStanding = 'up_to_date' | 'debtor' | 'deregistered';

export interface MemberAccount {
  memberId: string;
  /** Club-local date the account was derived for. */
  asOf: ClubDate;
  standing: AccountStanding;
  unpaidPeriodCount: number;
  owed: OwedPeriod[];
}

/**
 * Asks for a first-time registration. It carries no date on purpose: the service charges the registration
 * on the club-local day it takes the payment, so a client cannot backdate the enrollment to dodge the proration.
 */
export type RegistrationRequest = object;

export interface RegisterPaymentInput {
  concepts: readonly ChargeConcept[];
  method: PaymentMethod;
  registration?: RegistrationRequest;
  /**
   * Idempotency key (8 to 100 characters). The HTTP layer requires it; a service caller may omit it and
   * then gets no duplicate protection.
   */
  requestId?: string;
}

export interface PreviewOptions {
  registration?: RegistrationRequest;
}
