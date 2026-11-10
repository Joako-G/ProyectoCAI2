import type { AccountStanding } from '../payments/payment.types.js';
import type { MailSendState } from './notice.send-state.js';

/** What a notice sender needs to reach someone: a derived WhatsApp number and the text to send. */
export interface OutgoingNotice {
  number: string;
  message: string;
}

/** The ready-to-use result of preparing a notice: a link a secretary opens. A Business API sender would return a sent receipt instead. */
export interface PreparedNotice {
  link: string;
}

export interface NoticeSender {
  prepare(notice: OutgoingNotice): PreparedNotice;
}

export type NoticeRecipient = 'member' | 'guardian';

export interface DebtNotice {
  memberId: string;
  memberNumber: string;
  name: string;
  standing: Exclude<AccountStanding, 'up_to_date'>;
  unpaidPeriodCount: number;
  /** Pesos owed as of `asOf`; it changes with the surcharge tier of the payment date. */
  total: number;
  recipient: NoticeRecipient;
  recipientName: string;
  /** The number as stored for the recipient (the guardian's contact for a minor), so a secretary sees where it goes. */
  recipientContact: string;
  /** Null when no usable WhatsApp number could be derived. */
  link: string | null;
  numberIssue: boolean;
}

/** Whether the welcome can also go by email, and if not, why. The button is offered only when `available`. */
export type WelcomeEmailOffer =
  | {
      available: true;
      /** Where it would go, masked: `m***@gmail.com`. */
      maskedAddress: string;
      /** The last known send of this payment (kept in memory, lost on restart). Absent when none was tried. */
      lastSend?: MailSendState;
    }
  | { available: false; reason: 'mail_not_configured' | 'no_email' | 'guardian_without_email' };

/** The welcome sent after an enrollment payment: a minor's goes to the guardian, anyone else's to the member. */
export interface WelcomeNotice {
  memberId: string;
  recipient: NoticeRecipient;
  recipientName: string;
  /** Null when no usable WhatsApp number could be derived. */
  link: string | null;
  numberIssue: boolean;
  email: WelcomeEmailOffer;
}

/** What `POST /api/notices/welcome/:paymentId/email` answers once the mail server accepted the message. */
export interface WelcomeEmailSent {
  sent: true;
  maskedAddress: string;
  /** When the mail server accepted the message (ISO). */
  sentAt: string;
}

export interface DebtNoticeList {
  asOf: string;
  rows: DebtNotice[];
}
