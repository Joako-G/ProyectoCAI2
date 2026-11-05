import { toIsoDate } from '../../shared/date.js';
import { isMinor } from '../members/member.validation.js';
import type { Membership } from '../memberships/membership.types.js';
import { accountStanding, owedConcepts } from '../payments/account.js';
import { calculateCharge } from '../payments/charge.js';
import { earliestTariffPeriod } from '../payments/pricing.js';
import type { Payment } from '../payments/payment.types.js';
import type { PricingConfig } from '../payments/pricing-config.types.js';
import { buildDebtMessage } from './notice.message.js';
import { deriveWhatsappNumber } from './notice.number.js';
import type { DebtNotice, DebtNoticeList, NoticeRecipient, NoticeSender } from './notice.types.js';

const CLUB_NAME = 'Club Independiente';

/** The slice of a member the notices need; the members service satisfies it as it is. */
export interface NoticeMember {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  status: 'active' | 'inactive';
  birthDate: string;
  deactivation?: { date: string };
  guardian?: { name: string; contact: string };
}

// Ports owned by the notices module; the members, memberships and pricing services and the payments repository satisfy them.
export interface NoticeServiceDeps {
  members: { list(): Promise<NoticeMember[]> };
  memberships: { list(): Promise<Membership[]> };
  payments: { list(): Promise<Payment[]> };
  pricing: { get(): Promise<PricingConfig> };
  sender: NoticeSender;
  now?: () => Date;
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es');

export function createNoticeService({ members, memberships, payments, pricing, sender, now = () => new Date() }: NoticeServiceDeps) {
  return {
    // Every active member who owes at least one month, with the total as of today and a send link.
    // Each source is read once; the pure account and charge functions then run per member.
    async debtNotices(): Promise<DebtNoticeList> {
      const asOf = toIsoDate(now());
      const [allMembers, history, paid, config] = await Promise.all([members.list(), memberships.list(), payments.list(), pricing.get()]);
      const firstPeriod = earliestTariffPeriod(config);

      const entries: Array<{ row: DebtNotice; order: string; number: string }> = [];
      for (const member of allMembers) {
        if (member.status !== 'active') continue;
        const owed = owedConcepts({ member, memberships: history, payments: paid, firstPeriod, asOf });
        const standing = accountStanding(owed);
        if (standing === 'up_to_date') continue;

        // Same pricing as a payment of everything owed today; nothing is paid in advance.
        const { total } = calculateCharge({
          tariffs: config.tariffs,
          surchargeTiers: config.surchargeTiers,
          prorationRule: config.prorationRule,
          paymentDate: asOf,
          concepts: owed.flatMap((entry) => entry.concepts),
        });
        const name = `${member.firstName} ${member.lastName}`;
        // A minor is written to through the guardian; once of age the member is, even if a guardian is still stored.
        const guardian = isMinor(member.birthDate, asOf) ? member.guardian : undefined;
        const recipient: NoticeRecipient = guardian ? 'guardian' : 'member';
        const recipientName = guardian ? guardian.name : name;
        const number = deriveWhatsappNumber(guardian ? guardian.contact : member.whatsapp);
        const link = number
          ? sender.prepare({
              number,
              message: buildDebtMessage({
                clubName: CLUB_NAME,
                memberName: name,
                addressee: { kind: recipient, name: recipientName },
                unpaidPeriods: owed.map((entry) => entry.period),
                total,
                asOf,
              }),
            }).link
          : null;

        entries.push({
          row: {
            memberId: member.id,
            memberNumber: member.memberNumber,
            name,
            standing,
            unpaidPeriodCount: owed.length,
            total,
            recipient,
            recipientName,
            link,
            numberIssue: link === null,
          },
          order: `${member.lastName} ${member.firstName}`,
          number: member.memberNumber,
        });
      }

      entries.sort((a, b) => byName(a.order, b.order) || byName(a.number, b.number));
      return { asOf, rows: entries.map((entry) => entry.row) };
    },
  };
}

export type NoticeService = ReturnType<typeof createNoticeService>;
