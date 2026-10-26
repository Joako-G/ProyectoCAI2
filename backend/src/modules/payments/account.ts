import { activeDisciplineIdsForPeriod } from '../memberships/membership.period.js';
import type { Membership } from '../memberships/membership.types.js';
import type { ChargeConcept, ClubDate } from './charge.types.js';
import type { AccountStanding, OwedPeriod, Payment } from './payment.types.js';
import type { Period } from './pricing.types.js';
import { isDeregistered } from './standing.js';

/** The slice of a member the derivation needs. */
export interface AccountMember {
  id: string;
  status: 'active' | 'inactive';
  deactivation?: { date: ClubDate };
}

export interface OwedInput {
  member: AccountMember;
  memberships: readonly Membership[];
  /** Any payments; annulled ones and other members' are ignored here. */
  payments: readonly Payment[];
  /**
   * The first month that can be owed: the earliest tariff `effectiveFrom`. A technical floor, because a
   * month without a tariff cannot be priced; it is not a business rule.
   */
  firstPeriod: Period;
  /** Club-local date the account is derived for; its month is the last one that can be owed. */
  asOf: ClubDate;
}

/** Stable identity of a concept, used to match what a payment settled against what is owed. */
export function conceptKey(concept: ChargeConcept): string {
  switch (concept.kind) {
    case 'socialFee':
      return `socialFee:${concept.period}`;
    case 'activityFee':
      return `activityFee:${concept.period}:${concept.disciplineId}`;
    default:
      return concept.kind;
  }
}

/** Keys of the social and activity fees settled by the member's non-annulled payments. */
export function settledKeys(payments: readonly Payment[], memberId: string): Set<string> {
  const keys = new Set<string>();
  for (const payment of payments) {
    if (payment.memberId !== memberId || payment.annulment) continue;
    // Built through conceptKey, the single definition of a concept's identity, so settled and owed keys always match.
    for (const line of payment.lines) {
      if (line.kind === 'socialFee') keys.add(conceptKey({ kind: 'socialFee', period: line.period }));
      // The line type allows no disciplineId, but the repository rejects stored activity lines without one, so a valid file never skips here.
      else if (line.kind === 'activityFee' && line.disciplineId) {
        keys.add(conceptKey({ kind: 'activityFee', period: line.period, disciplineId: line.disciplineId }));
      }
    }
  }
  return keys;
}

function nextPeriod(period: Period): Period {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Unpaid concepts per month, oldest first. A month owes one social fee when the member had at least one
 * active discipline in it, plus one activity fee per such discipline. Months before `firstPeriod`, after
 * the as-of month, or after an inactive member's deactivation month are not owed. Pure; no I/O.
 */
export function owedConcepts({ member, memberships, payments, firstPeriod, asOf }: OwedInput): OwedPeriod[] {
  let lastPeriod = asOf.slice(0, 7);
  // Only a currently inactive member is capped: a reactivated one may still carry the old deactivation.
  if (member.status === 'inactive' && member.deactivation) {
    const deactivatedIn = member.deactivation.date.slice(0, 7);
    if (deactivatedIn < lastPeriod) lastPeriod = deactivatedIn;
  }
  const settled = settledKeys(payments, member.id);
  const owed: OwedPeriod[] = [];
  for (let period = firstPeriod; period <= lastPeriod; period = nextPeriod(period)) {
    const disciplineIds = activeDisciplineIdsForPeriod(memberships, member.id, period);
    if (disciplineIds.length === 0) continue;
    const due: OwedPeriod['concepts'] = [
      { kind: 'socialFee', period },
      ...disciplineIds.map((disciplineId) => ({ kind: 'activityFee' as const, period, disciplineId })),
    ];
    const concepts = due.filter((concept) => !settled.has(conceptKey(concept)));
    if (concepts.length > 0) owed.push({ period, concepts });
  }
  return owed;
}

/** Up to date with nothing owed, debtor up to 3 unpaid months, deregistered beyond that. */
export function accountStanding(owed: readonly OwedPeriod[]): AccountStanding {
  const unpaidMonths = new Set(owed.map((entry) => entry.period)).size;
  if (unpaidMonths === 0) return 'up_to_date';
  return isDeregistered(unpaidMonths) ? 'deregistered' : 'debtor';
}
