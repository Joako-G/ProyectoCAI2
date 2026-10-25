import type { ProrationRule, SurchargeTier, Tariff } from './pricing.types.js';

/**
 * Prices the club can change without a deploy (RF-23, RNF-13). Tariffs are dated and past ones are
 * immutable; the tiers and the proration rule are current configuration with no effective date.
 */
export interface PricingConfig {
  tariffs: Tariff[];
  surchargeTiers: SurchargeTier[];
  prorationRule: ProrationRule;
}

/** Everything the charge calculation needs for one billing period. */
export interface PricingForPeriod {
  tariff: Tariff;
  surchargeTiers: SurchargeTier[];
  prorationRule: ProrationRule;
}
