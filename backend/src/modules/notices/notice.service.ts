import { toIsoDate } from '../../shared/date.js';
import { isMinor } from '../members/member.validation.js';
import type { Membership } from '../memberships/membership.types.js';
import { accountStanding, owedConcepts } from '../payments/account.js';
import { calculateCharge } from '../payments/charge.js';
import { earliestTariffPeriod } from '../payments/pricing.js';
import type { Payment } from '../payments/payment.types.js';
import type { PricingConfig } from '../payments/pricing-config.types.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import { buildDebtMessage, buildWelcomeMessage, describeReceiptLine } from './notice.message.js';
import { deriveWhatsappNumber } from './notice.number.js';
import type { DebtNotice, DebtNoticeList, NoticeRecipient, NoticeSender, WelcomeNotice } from './notice.types.js';

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
  disciplines: { findByIds(ids: readonly string[]): Promise<Array<{ id: string; name: string }>> };
  sender: NoticeSender;
  now?: () => Date;
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es');

// A minor is written to through the guardian; once of age the member is, even if a guardian is still stored.
function resolveRecipient(
  member: NoticeMember,
  asOf: string,
): { recipient: NoticeRecipient; recipientName: string; contact: string; number: string | undefined } {
  const guardian = isMinor(member.birthDate, asOf) ? member.guardian : undefined;
  const contact = guardian ? guardian.contact : member.whatsapp;
  return {
    recipient: guardian ? 'guardian' : 'member',
    recipientName: guardian ? guardian.name : `${member.firstName} ${member.lastName}`,
    contact,
    number: deriveWhatsappNumber(contact),
  };
}

export function createNoticeService({ members, memberships, payments, pricing, disciplines, sender, now = () => new Date() }: NoticeServiceDeps) {
  return {
    // The welcome for the payment that enrolled a member, with the receipt in the message and a send link.
    async welcomeNotice(paymentId: string): Promise<WelcomeNotice> {
      const payment = (await payments.list()).find((current) => current.id === paymentId);
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.annulment) throw new ConflictError('Payment is annulled');
      const member = (await members.list()).find((current) => current.id === payment.memberId);
      if (!member) throw new NotFoundError('Member not found');

      const activityIds = payment.lines.flatMap((line) => (line.disciplineId ? [line.disciplineId] : []));
      const names = new Map((await disciplines.findByIds(activityIds)).map((discipline) => [discipline.id, discipline.name]));
      const memberName = `${member.firstName} ${member.lastName}`;
      const { recipient, recipientName, number } = resolveRecipient(member, payment.paymentDate);
      const link = number
        ? sender.prepare({
            number,
            message: buildWelcomeMessage({
              clubName: CLUB_NAME,
              memberName,
              addressee: { kind: recipient, name: recipientName },
              receiptNumber: payment.receiptNumber,
              paymentDate: payment.paymentDate,
              concepts: payment.lines.map((line) => describeReceiptLine(line, (id) => names.get(id) ?? 'actividad')),
              total: payment.total,
            }),
          }).link
        : null;
      return { memberId: member.id, recipient, recipientName, link, numberIssue: link === null };
    },

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
        const { recipient, recipientName, contact, number } = resolveRecipient(member, asOf);
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
            recipientContact: contact,
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
