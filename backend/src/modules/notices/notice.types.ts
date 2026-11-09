import type { AccountStanding } from '../payments/payment.types.js';

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

/** The welcome sent after an enrollment payment: a minor's goes to the guardian, anyone else's to the member. */
export interface WelcomeNotice {
  memberId: string;
  recipient: NoticeRecipient;
  recipientName: string;
  /** Null when no usable WhatsApp number could be derived. */
  link: string | null;
  numberIssue: boolean;
}

export interface DebtNoticeList {
  asOf: string;
  rows: DebtNotice[];
}
