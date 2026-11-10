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
