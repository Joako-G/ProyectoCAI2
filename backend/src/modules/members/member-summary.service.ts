import { toIsoDate } from '../../shared/date.js';
import type { Membership } from '../memberships/membership.types.js';
import { memberStanding, type AccountMember } from '../payments/account.js';
import { earliestTariffPeriod } from '../payments/pricing.js';
import type { Payment } from '../payments/payment.types.js';
import type { PricingConfig } from '../payments/pricing-config.types.js';
import type { MemberSummary } from './member-summary.types.js';

// Ports owned by this module; the members, memberships and pricing services and the payments repository satisfy them.
export interface MemberSummaryServiceDeps {
  members: { list(): Promise<AccountMember[]> };
  memberships: { list(): Promise<Membership[]> };
  payments: { list(): Promise<Payment[]> };
  pricing: { get(): Promise<PricingConfig> };
  now?: () => Date;
}

export function createMemberSummaryService({ members, memberships, payments, pricing, now = () => new Date() }: MemberSummaryServiceDeps) {
  return {
    // Standing is derived for active members only, the same way the debt notices do. Each source is read once.
    async summary(): Promise<MemberSummary> {
      const asOf = toIsoDate(now());
      const [allMembers, history, paid, config] = await Promise.all([members.list(), memberships.list(), payments.list(), pricing.get()]);
      const firstPeriod = earliestTariffPeriod(config);

      const ids: MemberSummary['ids'] = { upToDate: [], debtors: [], overdue: [] };
      let inactive = 0;
      for (const member of allMembers) {
        if (member.status !== 'active') {
          inactive += 1;
          continue;
        }
        const standing = memberStanding({ member, memberships: history, payments: paid, firstPeriod, asOf });
        if (standing === 'up_to_date') ids.upToDate.push(member.id);
        else if (standing === 'debtor') ids.debtors.push(member.id);
        else ids.overdue.push(member.id);
      }

      return {
        active: ids.upToDate.length + ids.debtors.length + ids.overdue.length,
        inactive,
        upToDate: ids.upToDate.length,
        debtors: ids.debtors.length,
        overdue: ids.overdue.length,
        ids,
      };
    },
  };
}

export type MemberSummaryService = ReturnType<typeof createMemberSummaryService>;
