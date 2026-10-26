import type { PricingConfig, Tariff } from '../types/pricing';

export function buildTariff(overrides: Partial<Tariff> = {}): Tariff {
  return {
    effectiveFrom: '2026-10',
    enrollment: 20000,
    socialFee: 15000,
    activityFee: 18000,
    carnetReplacement: 13000,
    ...overrides,
  };
}

/** A past tariff, the one in force in October 2026, and a future one. */
export function buildPricingConfig(overrides: Partial<PricingConfig> = {}): PricingConfig {
  return {
    tariffs: [
      buildTariff({ effectiveFrom: '2026-01', socialFee: 12000 }),
      buildTariff({ effectiveFrom: '2026-10' }),
      buildTariff({ effectiveFrom: '2026-12', socialFee: 17000 }),
    ],
    surchargeTiers: [
      { fromDay: 1, amount: 0 },
      { fromDay: 11, amount: 10000 },
    ],
    prorationRule: { afterDay: 15, activityPercent: 50 },
    ...overrides,
  };
}
