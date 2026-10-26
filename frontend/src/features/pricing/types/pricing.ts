/** Amounts in whole pesos, in force from `effectiveFrom` (`YYYY-MM`) until a later tariff replaces them. */
export interface Tariff {
  effectiveFrom: string;
  enrollment: number;
  socialFee: number;
  activityFee: number;
  carnetReplacement: number;
}

/** Late surcharge per activity from `fromDay` of the month until the next tier starts. */
export interface SurchargeTier {
  fromDay: number;
  amount: number;
}

/** A new member enrolling after `afterDay` pays `activityPercent` of each activity fee. */
export interface ProrationRule {
  afterDay: number;
  activityPercent: number;
}

/** Mirrors `GET /api/pricing`; tariffs arrive ordered by `effectiveFrom`. */
export interface PricingConfig {
  tariffs: Tariff[];
  surchargeTiers: SurchargeTier[];
  prorationRule: ProrationRule;
}
