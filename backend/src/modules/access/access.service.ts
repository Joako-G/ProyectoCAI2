import { toIsoDate } from '../../shared/date.js';
import type { Membership } from '../memberships/membership.types.js';
import { accountStanding, owedConcepts } from '../payments/account.js';
import type { Payment } from '../payments/payment.types.js';
import type { PricingConfig } from '../payments/pricing-config.types.js';
import { earliestTariffPeriod, lastDayWithoutSurcharge, nextPeriod } from '../payments/pricing.js';
import type { AccessCheck } from './access.types.js';
import type { EntranceContext, EntranceInput } from './entrance.js';

/** The slice of a member the check needs; the members service satisfies it as it is. */
export interface AccessMember {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  dni: string;
  status: 'active' | 'inactive';
  deactivation?: { date: string };
}

/** How many months past the current one the paid-through lookup goes before it stops. */
const MAX_MONTHS_AHEAD = 12;

// Ports owned by the access module; the members, memberships and pricing services and the payments repository satisfy them.
export interface AccessServiceDeps {
  members: { list(): Promise<AccessMember[]> };
  memberships: { list(): Promise<Membership[]> };
  payments: { list(): Promise<Payment[]> };
  pricing: { get(): Promise<PricingConfig> };
  /** Records the identified checks that come with an entrance context. Optional: without it the service only answers. */
  entrance?: { register(input: EntranceInput): Promise<void> };
  /** The names of a member's disciplines for the entrance screens. Optional: without it the list is empty. */
  memberDisciplines?: { namesFor(memberId: string): Promise<string[]> };
  now?: () => Date;
}

export function createAccessService({ members, memberships, payments, pricing, entrance, memberDisciplines, now = () => new Date() }: AccessServiceDeps) {
  // Each source is read once, then the member is picked by whichever key the caller has.
  async function answerFor(pick: (candidate: AccessMember) => boolean, context?: EntranceContext): Promise<AccessCheck> {
    const { answer, member } = await decide(pick);
    // A face that matches an inactive member is a leftover profile, which the door treats as not recognized, so nobody is named.
    const nameable = member && !(context?.method === 'face' && member.status === 'inactive') ? member : undefined;
    if (context && entrance) {
      const identified = nameable && {
        id: nameable.id,
        memberNumber: nameable.memberNumber,
        firstName: nameable.firstName,
        fullName: `${nameable.firstName} ${nameable.lastName}`,
        disciplines: await disciplineNamesOf(nameable.id),
      };
      await entrance.register({ member: identified, answer, ...context });
    }
    return answer;
  }

  // Read once per identified check. The discipline names only decorate the screens, so a failure must not fail the check.
  async function disciplineNamesOf(memberId: string): Promise<string[]> {
    try {
      return (await memberDisciplines?.namesFor(memberId)) ?? [];
    } catch {
      return [];
    }
  }

  async function decide(pick: (candidate: AccessMember) => boolean): Promise<{ answer: AccessCheck; member?: AccessMember }> {
    const asOf = toIsoDate(now());
    const [allMembers, history, paid, config] = await Promise.all([members.list(), memberships.list(), payments.list(), pricing.get()]);
    const member = allMembers.find(pick);
    if (!member) return { answer: { result: 'red', reason: 'not_found' } };
    return { answer: judge(member, history, paid, config, asOf), member };
  }

  function judge(member: AccessMember, history: Membership[], paid: Payment[], config: PricingConfig, asOf: string): AccessCheck {
    const owed = owedConcepts({ member, memberships: history, payments: paid, firstPeriod: earliestTariffPeriod(config), asOf });
    const summary = { memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, unpaidPeriodCount: owed.length };
    // An inactive member stays out whatever the account says.
    if (member.status === 'inactive') return { result: 'red', reason: 'inactive', member: summary };
    const standing = accountStanding(owed);
    if (standing !== 'up_to_date') {
      const indebted = { ...summary, debtSince: owed[0]!.period };
      return standing === 'deregistered' ? { result: 'red', reason: 'deregistered', member: indebted } : { result: 'yellow', reason: 'debtor', member: indebted };
    }
    // Members may pay months ahead, so extend the as-of month while nothing is owed, with the same rules.
    let paidThrough = asOf.slice(0, 7);
    for (let ahead = 0; ahead < MAX_MONTHS_AHEAD; ahead += 1) {
      const candidate = nextPeriod(paidThrough);
      const owedThen = owedConcepts({ member, memberships: history, payments: paid, firstPeriod: earliestTariffPeriod(config), asOf: `${candidate}-01` });
      if (owedThen.length > 0) {
        // The first unpaid month is the one after paidThrough; it falls due on its last day without surcharge.
        const dueDate = lastDayWithoutSurcharge(config.surchargeTiers, candidate);
        return { result: 'green', reason: 'up_to_date', member: { ...summary, paidThrough, dueDate } };
      }
      paidThrough = candidate;
    }
    // Nothing falls due within the window (for example, no active discipline), so any month shown would mislead.
    return { result: 'green', reason: 'up_to_date', member: summary };
  }

  return {
    // Whether the member with this (already validated) DNI may enter today.
    // Green: up to date. Yellow: owes 1 to 3 months and enters. Red: deregistered, inactive or unknown.
    // With a context (who ran it, by which method) an identified check is also handed to the entrance recorder.
    check: (dni: string, context?: EntranceContext): Promise<AccessCheck> => answerFor((candidate) => candidate.dni === dni, context),
    // The same answer for a member known by id, for entrances that do not start from a DNI (face recognition).
    checkMember: (memberId: string, context?: EntranceContext): Promise<AccessCheck> => answerFor((candidate) => candidate.id === memberId, context),
  };
}

export type AccessService = ReturnType<typeof createAccessService>;
