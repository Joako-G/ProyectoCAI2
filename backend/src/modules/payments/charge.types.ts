import type { Money, Period, ProrationRule, SurchargeTier, Tariff } from './pricing.types.js';

/** Club-local calendar date as `YYYY-MM-DD`. The caller converts instants using CLUB_TIME_ZONE. */
export type ClubDate = string;

/** One payable concept the caller decided is owed and is being collected now. */
export type ChargeConcept =
  | { kind: 'enrollment' }
  | { kind: 'socialFee'; period: Period }
  | { kind: 'activityFee'; period: Period; disciplineId: string }
  | { kind: 'carnetReplacement' };

/** Present only when this charge is a first-time registration (new member or re-registration). */
export interface FirstTimeRegistration {
  enrollmentDate: ClubDate;
}

export interface ChargeInput {
  tariffs: readonly Tariff[];
  surchargeTiers: readonly SurchargeTier[];
  prorationRule: ProrationRule;
  paymentDate: ClubDate;
  registration?: FirstTimeRegistration;
  concepts: readonly ChargeConcept[];
  /**
   * The caller states the member is up to date, so the month after the payment month may be paid in
   * advance, only while its social and activity fees equal the current month's. Off by default.
   */
  allowAdvance?: boolean;
}

export const CHARGE_LINE_KINDS = ['enrollment', 'socialFee', 'activityFee', 'activitySurcharge', 'carnetReplacement'] as const;
export type ChargeLineKind = (typeof CHARGE_LINE_KINDS)[number];

export interface ChargeLine {
  kind: ChargeLineKind;
  /** The period paid for; for enrollment and carnet replacement, the payment month. */
  period: Period;
  /** Set on activity fee lines and on the surcharge line linked to that activity. */
  disciplineId?: string;
  amount: Money;
  /** Set on activity fee lines only: true when the first-registration proration reduced the fee. */
  prorated?: boolean;
}

export interface Charge {
  lines: ChargeLine[];
  total: Money;
}
