/** Whole Argentine pesos. Always a safe non-negative integer, never a decimal. */
export type Money = number;

/** A calendar month as `YYYY-MM`. */
export type Period = string;

/** Amounts in force from `effectiveFrom` (inclusive) until a later tariff replaces them. */
export interface Tariff {
  effectiveFrom: Period;
  enrollment: Money;
  socialFee: Money;
  activityFee: Money;
  carnetReplacement: Money;
}

/** Late surcharge per activity that applies from `fromDay` of the month until the next tier starts. */
export interface SurchargeTier {
  fromDay: number;
  amount: Money;
}

/** A new member enrolling after `afterDay` pays `activityPercent` of each activity fee. */
export interface ProrationRule {
  afterDay: number;
  activityPercent: number;
}

export interface ProrationContext {
  isNewMember: boolean;
  /** Day of the month the member enrolls on. */
  enrollmentDay: number;
}
