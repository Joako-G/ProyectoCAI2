import { toIsoDate } from '../../shared/date.js';
import type { Membership } from '../memberships/membership.types.js';
import { accountStanding, owedConcepts } from '../payments/account.js';
import type { Payment } from '../payments/payment.types.js';
import type { PricingConfig } from '../payments/pricing-config.types.js';
import { earliestTariffPeriod } from '../payments/pricing.js';
import type { AccessCheck } from './access.types.js';

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

// Ports owned by the access module; the members, memberships and pricing services and the payments repository satisfy them.
export interface AccessServiceDeps {
  members: { list(): Promise<AccessMember[]> };
  memberships: { list(): Promise<Membership[]> };
  payments: { list(): Promise<Payment[]> };
  pricing: { get(): Promise<PricingConfig> };
  now?: () => Date;
}

export function createAccessService({ members, memberships, payments, pricing, now = () => new Date() }: AccessServiceDeps) {
  return {
    // Whether the member with this (already validated) DNI may enter today. Each source is read once.
    // Green: up to date. Yellow: owes 1 to 3 months and enters. Red: deregistered, inactive or unknown.
    async check(dni: string): Promise<AccessCheck> {
      const asOf = toIsoDate(now());
      const [allMembers, history, paid, config] = await Promise.all([members.list(), memberships.list(), payments.list(), pricing.get()]);
      const member = allMembers.find((candidate) => candidate.dni === dni);
      if (!member) return { result: 'red', reason: 'not_found' };

      const owed = owedConcepts({ member, memberships: history, payments: paid, firstPeriod: earliestTariffPeriod(config), asOf });
      const summary = { memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, unpaidPeriodCount: owed.length };
      // An inactive member stays out whatever the account says.
      if (member.status === 'inactive') return { result: 'red', reason: 'inactive', member: summary };
      const standing = accountStanding(owed);
      if (standing === 'deregistered') return { result: 'red', reason: 'deregistered', member: summary };
      return standing === 'debtor' ? { result: 'yellow', reason: 'debtor', member: summary } : { result: 'green', reason: 'up_to_date', member: summary };
    },
  };
}

export type AccessService = ReturnType<typeof createAccessService>;
