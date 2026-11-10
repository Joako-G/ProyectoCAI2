/** Email sending is not set up on this server (the SMTP variables are missing or unusable). */
export class MailNotConfiguredError extends Error {
  constructor() {
    super('Email sending is not configured');
    this.name = 'MailNotConfiguredError';
  }
}

/** The mail server did not accept the message. The cause stays out of the message: it may name hosts or accounts. */
export class MailSendError extends Error {
  constructor() {
    super('The email could not be sent');
    this.name = 'MailSendError';
  }
}

/** The mail server may already have accepted the message (a timeout or a lost connection): the outcome is unknown, so a resend can duplicate it. */
export class MailSendUncertainError extends Error {
  constructor() {
    super('The email may or may not have been sent');
    this.name = 'MailSendUncertainError';
  }
}

/** A send for this payment is running right now. */
export class MailSendInProgressError extends Error {
  constructor() {
    super('An email for this payment is already being sent');
    this.name = 'MailSendInProgressError';
  }
}

/** The payment already has a sent (or uncertain) email and the request did not say `resend: true`. */
export class MailAlreadySentError extends Error {
  constructor(readonly lastSend: { status: 'sent' | 'uncertain'; at: string; to: string }) {
    super('The email for this payment was already sent');
    this.name = 'MailAlreadySentError';
  }
}
