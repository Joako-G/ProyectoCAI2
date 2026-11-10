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
import { MailAlreadySentError, MailNotConfiguredError, MailSendError, MailSendInProgressError, MailSendUncertainError } from './notice.errors.js';
import { createMailSendStore, isClearRejection, SendTimeoutError, type MailSendState, type MailSendStore } from './notice.send-state.js';
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
  /** Per-payment send state; defaults to a fresh in-memory store. Injected so tests control it. */
  sendState?: MailSendStore;
  /** Upper bound of one send in milliseconds (default 15 s). The SMTP timeouts are shorter, so this is the backstop. */
  sendTimeoutMs?: number;
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
function emailOffer(member: NoticeMember, recipient: NoticeRecipient, mailConfigured: boolean, lastSend?: MailSendState): WelcomeEmailOffer {
  if (!mailConfigured) return { available: false, reason: 'mail_not_configured' };
  if (recipient === 'guardian') return { available: false, reason: 'guardian_without_email' };
  if (!member.email) return { available: false, reason: 'no_email' };
  return { available: true, maskedAddress: maskEmail(member.email), ...(lastSend ? { lastSend } : {}) };
}

/** The whole send is bounded to about this long; the client gives up a little later (20 s). */
export const MAIL_SEND_TIMEOUT_MS = 15_000;

// Rejects with SendTimeoutError when the transport does not answer in time; the timer never outlives the call.
async function bounded<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SendTimeoutError()), ms);
  });
  // A late rejection of the abandoned work must not surface as an unhandled rejection.
  work.catch(() => undefined);
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createNoticeService({ members, memberships, payments, pricing, disciplines, sender, mailer, receipts, sendState = createMailSendStore(), sendTimeoutMs = MAIL_SEND_TIMEOUT_MS, now = () => new Date() }: NoticeServiceDeps) {
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
      return { memberId: member.id, recipient, recipientName, link, numberIssue: link === null, email: emailOffer(member, recipient, Boolean(mailer && receipts), sendState.get(paymentId)) };
    },

    // Emails the welcome with the receipt PDF attached. The send is bounded in time and remembered per payment, so a
    // second click, a remount or a retry after a timeout cannot silently send it twice. A refusal never reveals the SMTP details.
    async sendWelcomeEmail(paymentId: string, { resend = false }: { resend?: boolean } = {}): Promise<WelcomeEmailSent> {
      if (!mailer || !receipts) throw new MailNotConfiguredError();
      const { member, memberName, recipient, recipientName, payment, concepts } = await welcomeContext(paymentId);
      const offer = emailOffer(member, recipient, true);
      if (!offer.available || !member.email) throw new ConflictError('The recipient has no email address');

      // Check and mark in one synchronous step: nothing is awaited in between, so two requests cannot both pass.
      const previous = sendState.get(paymentId);
      if (previous?.status === 'sending') throw new MailSendInProgressError();
      if (previous && !resend) throw new MailAlreadySentError(previous);
      sendState.set(paymentId, { status: 'sending', at: now().toISOString(), to: offer.maskedAddress });
      // A plain failure leaves the payment as it was before this attempt, so a normal retry stays possible.
      const restore = () => (previous ? sendState.set(paymentId, previous) : sendState.delete(paymentId));

      let message: Parameters<Mailer['send']>[0];
      try {
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
        message = {
          to: member.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          attachments: [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }],
          inlineImages: crest ? [{ cid: CREST_CID, filename: 'logo-cai.png', content: crest, contentType: 'image/png' }] : [],
        };
      } catch (error) {
        restore();
        throw error;
      }

      try {
        await bounded(mailer.send(message), sendTimeoutMs);
      } catch (error) {
        // Only the error code is logged: a message can carry the server address or the account.
        console.error('Welcome email could not be sent', (error as { code?: unknown } | null)?.code ?? 'unknown');
        if (isClearRejection(error)) {
          restore();
          throw new MailSendError();
        }
        sendState.set(paymentId, { status: 'uncertain', at: now().toISOString(), to: offer.maskedAddress });
        throw new MailSendUncertainError();
      }
      const sentAt = now().toISOString();
      sendState.set(paymentId, { status: 'sent', at: sentAt, to: offer.maskedAddress });
      return { sent: true, maskedAddress: offer.maskedAddress, sentAt };
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
