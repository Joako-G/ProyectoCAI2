import type { ProrationRule, SurchargeTier, Tariff } from '../types/pricing';

// Mirrors backend/src/modules/payments/pricing.ts and pricing-config.service.ts. The backend stays the
// source of truth; this only gives early feedback. Messages are UI copy (Spanish).

const MAX_DAY = 31;
const WHOLE_NUMBER = /^\d+$/;
const MONEY_ERROR = 'Ingrese un monto entero en pesos.';

/** Parses digits only: no sign, decimals, or exponent. Returns undefined when it is not a safe whole number. */
function parseWhole(text: string): number | undefined {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** The club-local current month as `YYYY-MM`. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface TierRow {
  fromDay: string;
  amount: string;
}

export function validateTiers(rows: TierRow[]): { tiers?: SurchargeTier[]; error?: string } {
  if (rows.length === 0) return { error: 'Agregue al menos un tramo.' };
  const tiers: SurchargeTier[] = [];
  for (const row of rows) {
    const fromDay = parseWhole(row.fromDay);
    const amount = parseWhole(row.amount);
    if (fromDay === undefined || amount === undefined) {
      return { error: 'Complete cada tramo con números enteros, sin decimales.' };
    }
    tiers.push({ fromDay, amount });
  }
  if (tiers[0].fromDay !== 1) return { error: 'El primer tramo debe empezar el día 1.' };
  if (tiers.some(({ fromDay }) => fromDay < 1 || fromDay > MAX_DAY)) {
    return { error: `Los días deben estar entre 1 y ${MAX_DAY}.` };
  }
  if (tiers.some(({ fromDay }, index) => index > 0 && fromDay <= tiers[index - 1].fromDay)) {
    return { error: 'Los días deben ir en orden estrictamente creciente.' };
  }
  return { tiers };
}

export interface ProrationValues {
  afterDay: string;
  activityPercent: string;
}

export function validateProration(values: ProrationValues): { errors: Partial<Record<keyof ProrationValues, string>>; rule?: ProrationRule } {
  const afterDay = parseWhole(values.afterDay);
  const activityPercent = parseWhole(values.activityPercent);
  const errors: Partial<Record<keyof ProrationValues, string>> = {};
  if (afterDay === undefined || afterDay < 1 || afterDay > MAX_DAY) {
    errors.afterDay = `Ingrese un día entero entre 1 y ${MAX_DAY}.`;
  }
  if (activityPercent === undefined || activityPercent > 100) {
    errors.activityPercent = 'Ingrese un porcentaje entero entre 0 y 100.';
  }
  if (afterDay === undefined || activityPercent === undefined || Object.keys(errors).length > 0) return { errors };
  return { errors, rule: { afterDay, activityPercent } };
}

export type MoneyField = 'enrollment' | 'socialFee' | 'activityFee' | 'carnetReplacement';

export const MONEY_FIELDS: ReadonlyArray<{ name: MoneyField; label: string }> = [
  { name: 'enrollment', label: 'Matrícula' },
  { name: 'socialFee', label: 'Cuota social' },
  { name: 'activityFee', label: 'Cuota por actividad' },
  { name: 'carnetReplacement', label: 'Reposición de carnet' },
];

/** Form state: every input is text. */
export type TariffFormValues = Record<MoneyField | 'effectiveFrom', string>;

export function validateTariffForm(
  values: TariffFormValues,
  month: string,
): { errors: Partial<Record<keyof TariffFormValues, string>>; tariff?: Tariff } {
  const errors: Partial<Record<keyof TariffFormValues, string>> = {};
  if (!values.effectiveFrom) errors.effectiveFrom = 'Elija el mes desde el cual rige la tarifa.';
  else if (values.effectiveFrom < month) errors.effectiveFrom = 'Elija el mes actual o uno posterior.';

  const amounts = {} as Record<MoneyField, number>;
  for (const { name } of MONEY_FIELDS) {
    const amount = parseWhole(values[name]);
    if (amount === undefined) errors[name] = MONEY_ERROR;
    else amounts[name] = amount;
  }
  if (Object.keys(errors).length > 0) return { errors };
  return { errors, tariff: { effectiveFrom: values.effectiveFrom, ...amounts } };
}
