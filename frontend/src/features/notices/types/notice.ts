/** Mirrors `DebtNotice` in backend/src/modules/notices/notice.types.ts. */
export interface DebtNotice {
  memberId: string;
  memberNumber: string;
  name: string;
  standing: 'debtor' | 'deregistered';
  unpaidPeriodCount: number;
  /** Pesos owed as of the list date; it changes with the surcharge tier of the payment date. */
  total: number;
  recipient: 'member' | 'guardian';
  recipientName: string;
  /** The number as stored for the recipient (the guardian's contact for a minor). */
  recipientContact: string;
  /** Null when the server could not derive a usable WhatsApp number. */
  link: string | null;
  numberIssue: boolean;
}

export interface DebtNoticeList {
  asOf: string;
  rows: DebtNotice[];
}

/** Mirrors `WelcomeEmailOffer`: whether the welcome can also go by email. */
export type WelcomeEmailOffer =
  | { available: true; /** Where it would go, masked: `m***@gmail.com`. */ maskedAddress: string }
  | { available: false; reason: 'mail_not_configured' | 'no_email' | 'guardian_without_email' };

/** Mirrors `WelcomeEmailSent` in backend/src/modules/notices/notice.types.ts. */
export interface WelcomeEmailSent {
  sent: true;
  maskedAddress: string;
}

/** Mirrors `WelcomeNotice` in backend/src/modules/notices/notice.types.ts. */
export interface WelcomeNotice {
  memberId: string;
  recipient: 'member' | 'guardian';
  recipientName: string;
  /** Null when the server could not derive a usable WhatsApp number. */
  link: string | null;
  numberIssue: boolean;
  /** Missing in the answer of an older server: treated as not available. */
  email?: WelcomeEmailOffer;
}
