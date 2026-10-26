import { ValidationError } from '../../shared/errors.js';
import type { ProrationRule, SurchargeTier, Tariff } from './pricing.types.js';

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError({ [field]: 'Must be a JSON object' });
  }
  return value as Record<string, unknown>;
}

// Field values are passed through as-is: the domain asserts reject anything that is not valid.
function pickTariff(body: Record<string, unknown>, effectiveFrom: unknown): Tariff {
  return {
    effectiveFrom: effectiveFrom as string,
    enrollment: body.enrollment as number,
    socialFee: body.socialFee as number,
    activityFee: body.activityFee as number,
    carnetReplacement: body.carnetReplacement as number,
  };
}

/** Body of POST /tariffs: the amounts plus their `effectiveFrom`. */
export function parseNewTariff(body: unknown): Tariff {
  const record = asRecord(body, 'body');
  return pickTariff(record, record.effectiveFrom);
}

/** Body of PUT /tariffs/:effectiveFrom: the amounts; `effectiveFrom` is optional but must match the path. */
export function parseTariffReplacement(body: unknown, effectiveFrom: string): Tariff {
  const record = asRecord(body, 'body');
  return pickTariff(record, record.effectiveFrom ?? effectiveFrom);
}

export function parseSurchargeTiers(body: unknown): SurchargeTier[] {
  if (!Array.isArray(body)) throw new ValidationError({ surchargeTiers: 'Must be an array of tiers' });
  return body.map((item) => {
    const tier = asRecord(item, 'surchargeTiers');
    return { fromDay: tier.fromDay as number, amount: tier.amount as number };
  });
}

export function parseProrationRule(body: unknown): ProrationRule {
  const rule = asRecord(body, 'prorationRule');
  return { afterDay: rule.afterDay as number, activityPercent: rule.activityPercent as number };
}
