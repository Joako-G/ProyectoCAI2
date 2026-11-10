/** Where the welcome email of one payment stands. `to` is always the masked address. */
export type MailSendState =
  | { status: 'sending'; at: string; to: string }
  | { status: 'sent'; at: string; to: string }
  | { status: 'uncertain'; at: string; to: string };

/** Per-payment send state. Kept in memory on purpose: it is lost when the server restarts (see docs/welcome-email.md). */
export interface MailSendStore {
  get(paymentId: string): MailSendState | undefined;
  set(paymentId: string, state: MailSendState): void;
  delete(paymentId: string): void;
}

export function createMailSendStore(): MailSendStore {
  const states = new Map<string, MailSendState>();
  return {
    get: (paymentId) => states.get(paymentId),
    set: (paymentId, state) => {
      states.set(paymentId, state);
    },
    delete: (paymentId) => {
      states.delete(paymentId);
    },
  };
}

/**
 * Error codes (nodemailer or Node) that prove the message was NOT accepted: the server refused the account or the
 * envelope, or the connection was never made. Anything else (a timeout, a reset, an unknown code) may have happened
 * after the server took the message, so it counts as uncertain.
 */
const REFUSED_BEFORE_SENDING = new Set(['EAUTH', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS', 'EENVELOPE', 'ETLS']);

export function isClearRejection(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && REFUSED_BEFORE_SENDING.has(code);
}

/** Raised by the service's own timer, never by the transport. */
export class SendTimeoutError extends Error {
  readonly code = 'ESENDTIMEOUT';
}
