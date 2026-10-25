import { ValidationError } from '../../shared/errors.js';
import type { Charge, ChargeConcept, ChargeInput, ChargeLine, ClubDate } from './charge.types.js';
import { prorateActivityFee, resolveTariff, surchargeForDay } from './pricing.js';
import type { Period } from './pricing.types.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

interface ParsedDate {
  period: Period;
  day: number;
}

function fail(field: string, message: string): never {
  throw new ValidationError({ [field]: message });
}

/** Validates a real calendar date; only used to reject impossible dates like 2026-02-30. */
function parseClubDate(value: ClubDate, field: string): ParsedDate {
  const match = DATE_PATTERN.exec(value);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day) {
      return { period: value.slice(0, 7), day };
    }
  }
  return fail(field, 'Must be a real calendar date formatted as YYYY-MM-DD');
}

/** Rejects malformed concepts and duplicates the system must never charge twice in one payment. */
function assertConcepts(concepts: readonly ChargeConcept[], paymentPeriod: Period, isFirstTime: boolean): void {
  if (concepts.length === 0) fail('concepts', 'At least one concept is required');
  const seen = new Set<string>();
  for (const concept of concepts) {
    let key: string;
    switch (concept.kind) {
      case 'enrollment':
        if (!isFirstTime) fail('concepts', 'Enrollment is only charged on a first-time registration');
        key = 'enrollment';
        break;
      case 'carnetReplacement':
        key = 'carnetReplacement';
        break;
      case 'socialFee':
      case 'activityFee': {
        if (!PERIOD_PATTERN.test(concept.period)) fail('period', 'Must be a period formatted as YYYY-MM');
        // YYYY-MM strings compare chronologically. Advance payment is not a system rule.
        if (concept.period > paymentPeriod) fail('period', `${concept.period} is after the payment month`);
        if (concept.kind === 'activityFee') {
          if (!concept.disciplineId) fail('disciplineId', 'An activity fee needs a discipline');
          key = `activityFee:${concept.period}:${concept.disciplineId}`;
        } else {
          key = `socialFee:${concept.period}`;
        }
        break;
      }
      default:
        return fail('concepts', 'Unknown concept');
    }
    if (seen.has(key)) fail('concepts', `Duplicate concept ${key}`);
    seen.add(key);
  }
  if (isFirstTime && !seen.has('enrollment')) {
    fail('concepts', 'A first-time registration must include the enrollment fee');
  }
}

/**
 * Itemizes what a single payment collects. Pure: the caller decides which concepts are owed and
 * converts "now" to a club-local date. Paying one concept never settles another.
 *
 * Surcharge: one line per activity, by the PAYMENT date's day, for any period (an overdue month adds
 * nothing for the missed month). A new member's enrollment month is never surcharged, because it had
 * no earlier due date (owner decision, 2026-10-25).
 */
export function calculateCharge(input: ChargeInput): Charge {
  const payment = parseClubDate(input.paymentDate, 'paymentDate');
  const enrollment = input.registration ? parseClubDate(input.registration.enrollmentDate, 'enrollmentDate') : undefined;
  assertConcepts(input.concepts, payment.period, enrollment !== undefined);

  const paymentTariff = resolveTariff(input.tariffs, payment.period);
  const lines: ChargeLine[] = [];

  for (const concept of input.concepts) {
    switch (concept.kind) {
      case 'enrollment':
        lines.push({ kind: 'enrollment', period: payment.period, amount: paymentTariff.enrollment });
        break;
      case 'carnetReplacement':
        lines.push({ kind: 'carnetReplacement', period: payment.period, amount: paymentTariff.carnetReplacement });
        break;
      case 'socialFee':
        lines.push({
          kind: 'socialFee',
          period: concept.period,
          amount: resolveTariff(input.tariffs, concept.period).socialFee,
        });
        break;
      case 'activityFee': {
        const fee = resolveTariff(input.tariffs, concept.period).activityFee;
        const inEnrollmentPeriod = enrollment !== undefined && enrollment.period === concept.period;
        const amount = prorateActivityFee(fee, input.prorationRule, {
          isNewMember: inEnrollmentPeriod,
          enrollmentDay: enrollment?.day ?? 1,
        });
        lines.push({
          kind: 'activityFee',
          period: concept.period,
          disciplineId: concept.disciplineId,
          amount,
          prorated: amount !== fee,
        });
        const surcharge = inEnrollmentPeriod ? 0 : surchargeForDay(input.surchargeTiers, payment.day);
        if (surcharge > 0) {
          lines.push({
            kind: 'activitySurcharge',
            period: concept.period,
            disciplineId: concept.disciplineId,
            amount: surcharge,
          });
        }
        break;
      }
    }
  }

  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}
