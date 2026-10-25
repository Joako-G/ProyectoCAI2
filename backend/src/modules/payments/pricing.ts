import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { Money, Period, ProrationContext, ProrationRule, SurchargeTier, Tariff } from './pricing.types.js';

// Defaults mirror the owner-confirmed rules in docs/team-handoff.md. They are what the pricing
// configuration returns until an administrator saves a change.
export const DEFAULT_TARIFF: Tariff = {
  effectiveFrom: '2026-01',
  enrollment: 20_000,
  socialFee: 20_000,
  activityFee: 20_000,
  carnetReplacement: 3_000,
};

export const DEFAULT_SURCHARGE_TIERS: readonly SurchargeTier[] = [
  { fromDay: 1, amount: 0 },
  { fromDay: 11, amount: 3_000 },
  { fromDay: 16, amount: 5_000 },
  { fromDay: 21, amount: 7_000 },
];

export const DEFAULT_PRORATION_RULE: ProrationRule = { afterDay: 15, activityPercent: 50 };

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_DAY_OF_MONTH = 31;

function fail(field: string, message: string): never {
  throw new ValidationError({ [field]: message });
}

function assertDay(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_DAY_OF_MONTH) {
    fail(field, `Must be a whole day between 1 and ${MAX_DAY_OF_MONTH}`);
  }
}

export function assertPeriod(value: string, field: string): void {
  if (!PERIOD_PATTERN.test(value)) fail(field, 'Must be a period formatted as YYYY-MM');
}

export function assertMoney(value: number, field: string): asserts value is Money {
  if (!Number.isSafeInteger(value) || value < 0) fail(field, 'Must be a non-negative whole number of pesos');
}

export function assertTariff(tariff: Tariff): void {
  assertPeriod(tariff.effectiveFrom, 'effectiveFrom');
  assertMoney(tariff.enrollment, 'enrollment');
  assertMoney(tariff.socialFee, 'socialFee');
  assertMoney(tariff.activityFee, 'activityFee');
  assertMoney(tariff.carnetReplacement, 'carnetReplacement');
}

/** Every tariff must be valid, and no two may start the same month (the price would depend on input order). */
export function assertTariffs(tariffs: readonly Tariff[]): void {
  const seenEffectiveFrom = new Set<Period>();
  for (const tariff of tariffs) {
    assertTariff(tariff);
    if (seenEffectiveFrom.has(tariff.effectiveFrom)) {
      fail('effectiveFrom', `More than one tariff starts on ${tariff.effectiveFrom}`);
    }
    seenEffectiveFrom.add(tariff.effectiveFrom);
  }
}

/** Returns the tariff whose `effectiveFrom` is the latest one not after `period`. */
export function resolveTariff(tariffs: readonly Tariff[], period: Period): Tariff {
  assertPeriod(period, 'period');
  assertTariffs(tariffs);
  let inForce: Tariff | undefined;
  for (const tariff of tariffs) {
    // YYYY-MM strings compare chronologically.
    if (tariff.effectiveFrom <= period && (!inForce || tariff.effectiveFrom > inForce.effectiveFrom)) {
      inForce = tariff;
    }
  }
  if (!inForce) throw new NotFoundError(`No tariff in force for ${period}`);
  return inForce;
}

/** Tiers must start at day 1, ascend strictly, stay within the month and carry valid amounts. */
export function assertSurchargeTiers(tiers: readonly SurchargeTier[]): void {
  if (tiers.length === 0) fail('surchargeTiers', 'At least one tier is required');
  if (tiers[0].fromDay !== 1) fail('surchargeTiers', 'The first tier must start on day 1');
  let previousDay = 0;
  for (const tier of tiers) {
    assertDay(tier.fromDay, 'surchargeTiers');
    assertMoney(tier.amount, 'surchargeTiers');
    if (tier.fromDay <= previousDay) fail('surchargeTiers', 'Tiers must be in strictly ascending day order');
    previousDay = tier.fromDay;
  }
}

/** Late surcharge for one activity paid on `paymentDay`; the last tier has no upper bound. */
export function surchargeForDay(tiers: readonly SurchargeTier[], paymentDay: number): Money {
  assertSurchargeTiers(tiers);
  assertDay(paymentDay, 'paymentDay');
  let amount = tiers[0].amount;
  for (const tier of tiers) {
    if (tier.fromDay <= paymentDay) amount = tier.amount;
  }
  return amount;
}

export function assertProrationRule(rule: ProrationRule): void {
  assertDay(rule.afterDay, 'afterDay');
  if (!Number.isInteger(rule.activityPercent) || rule.activityPercent < 0 || rule.activityPercent > 100) {
    fail('activityPercent', 'Must be a whole percentage between 0 and 100');
  }
}

/**
 * Activity fee owed by a member. Only a NEW member enrolling after `rule.afterDay` pays a reduced
 * share, rounded half up to whole pesos. Enrollment and social fee are never passed through here.
 */
export function prorateActivityFee(activityFee: Money, rule: ProrationRule, context: ProrationContext): Money {
  assertMoney(activityFee, 'activityFee');
  assertProrationRule(rule);
  assertDay(context.enrollmentDay, 'enrollmentDay');
  if (!context.isNewMember || context.enrollmentDay <= rule.afterDay) return activityFee;
  return Math.floor((activityFee * rule.activityPercent + 50) / 100);
}
