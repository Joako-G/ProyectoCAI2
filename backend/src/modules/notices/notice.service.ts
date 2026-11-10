import { CLUB_NAME } from '../../shared/club.js';
import { toIsoDate } from '../../shared/date.js';
import { isMinor } from '../members/member.validation.js';
import type { Membership } from '../memberships/membership.types.js';
import { accountStanding, owedConcepts } from '../payments/account.js';
import { calculateCharge } from '../payments/charge.js';
import { earliestTariffPeriod } from '../payments/pricing.js';
import type { Payment } from '../payments/payment.types.js';
import type { PricingConfig } from '../payments/pricing-config.types.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import { loadCrest } from '../payments/receipt.pdf.js';
import type { ReceiptPdfService } from '../payments/receipt.service.js';
import { buildWelcomeEmail, CREST_CID } from './notice.email.js';
import { MailNotConfiguredError, MailSendError } from './notice.errors.js';
import { buildDebtMessage, buildWelcomeMessage, describeReceiptLine } from './notice.message.js';
import type { Mailer } from './notice.mailer.js';
import { deriveWhatsappNumber } from './notice.number.js';
import type { DebtNotice, DebtNoticeList, NoticeRecipient, NoticeSender, WelcomeEmailOffer, WelcomeEmailSent, WelcomeNotice } from './notice.types.js';


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
  email?: string;
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
  /** Absent when no mailbox is configured: the welcome then offers no email. */
  mailer?: Mailer;
  /** Renders the receipt PDF the welcome email attaches. */
  receipts?: Pick<ReceiptPdfService, 'render'>;
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

/** `maria@gmail.com` as `m***@gmail.com`: enough to recognize the address, not to disclose it. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  return at <= 0 ? '***' : `${address[0]}***${address.slice(at)}`;
}

// A minor is written to through the guardian, and the model stores no email for a guardian: never fall back to the minor's own.
function emailOffer(member: NoticeMember, recipient: NoticeRecipient, mailConfigured: boolean): WelcomeEmailOffer {
  if (!mailConfigured) return { available: false, reason: 'mail_not_configured' };
  if (recipient === 'guardian') return { available: false, reason: 'guardian_without_email' };
  if (!member.email) return { available: false, reason: 'no_email' };
  return { available: true, maskedAddress: maskEmail(member.email) };
}

export function createNoticeService({ members, memberships, payments, pricing, disciplines, sender, mailer, receipts, now = () => new Date() }: NoticeServiceDeps) {
  // The payment, its member and the wording both channels share. Refuses an unknown or annulled payment.
  async function welcomeContext(paymentId: string) {
    const payment = (await payments.list()).find((current) => current.id === paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.annulment) throw new ConflictError('Payment is annulled');
    const member = (await members.list()).find((current) => current.id === payment.memberId);
    if (!member) throw new NotFoundError('Member not found');
    const activityIds = payment.lines.flatMap((line) => (line.disciplineId ? [line.disciplineId] : []));
    const names = new Map((await disciplines.findByIds(activityIds)).map((discipline) => [discipline.id, discipline.name]));
    const memberName = `${member.firstName} ${member.lastName}`;
    const resolved = resolveRecipient(member, payment.paymentDate);
    return {
      payment,
      member,
      memberName,
      ...resolved,
      concepts: payment.lines.map((line) => describeReceiptLine(line, (id) => names.get(id) ?? 'actividad')),
    };
  }

  return {
    // The welcome for the payment that enrolled a member, with the receipt in the message and a send link.
    async welcomeNotice(paymentId: string): Promise<WelcomeNotice> {
      const { member, memberName, recipient, recipientName, number, payment, concepts } = await welcomeContext(paymentId);
      const link = number
        ? sender.prepare({
            number,
            message: buildWelcomeMessage({
              clubName: CLUB_NAME,
              memberName,
              addressee: { kind: recipient, name: recipientName },
              receiptNumber: payment.receiptNumber,
              paymentDate: payment.paymentDate,
              concepts,
              total: payment.total,
            }),
          }).link
        : null;
      return { memberId: member.id, recipient, recipientName, link, numberIssue: link === null, email: emailOffer(member, recipient, Boolean(mailer && receipts)) };
    },

    // Emails the welcome with the receipt PDF attached. Nothing is stored; a refusal never reveals the SMTP details.
    async sendWelcomeEmail(paymentId: string): Promise<WelcomeEmailSent> {
      if (!mailer || !receipts) throw new MailNotConfiguredError();
      const { member, memberName, recipient, recipientName, payment, concepts } = await welcomeContext(paymentId);
      const offer = emailOffer(member, recipient, true);
      if (!offer.available || !member.email) throw new ConflictError('The recipient has no email address');
      const pdf = await receipts.render(payment.id);
      const crest = loadCrest();
      const email = buildWelcomeEmail({
        clubName: CLUB_NAME,
        memberName,
        addressee: { kind: recipient, name: recipientName },
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        concepts,
        total: payment.total,
        crest: crest !== undefined,
      });
      try {
        await mailer.send({
          to: member.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          attachments: [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }],
          inlineImages: crest ? [{ cid: CREST_CID, filename: 'logo-cai.png', content: crest, contentType: 'image/png' }] : [],
        });
      } catch (error) {
        // Only the error code is logged: a message can carry the server address or the account.
        console.error('Welcome email could not be sent', (error as { code?: unknown } | null)?.code ?? 'unknown');
        throw new MailSendError();
      }
      return { sent: true, maskedAddress: offer.maskedAddress };
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
