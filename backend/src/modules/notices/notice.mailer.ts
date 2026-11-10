import nodemailer from 'nodemailer';
import type { MailConfig } from '../../config/mail.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: EmailAttachment[];
  /** Images the HTML shows through `cid:`; shown inline, not as attachments. */
  inlineImages: Array<{ cid: string; filename: string; content: Buffer; contentType: string }>;
}

/** The seam to the outgoing mailbox. A rejection means the message was not accepted by the server. */
export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/** The slice of a nodemailer transport the mailer uses, so tests inject a fake and never open a connection. */
export interface MailTransport {
  sendMail(message: Record<string, unknown>): Promise<unknown>;
}

export function createSmtpTransport(config: MailConfig): MailTransport {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.auth ? { auth: { user: config.auth.user, pass: config.auth.password } } : {}),
    // A slow server must not hold a secretary's request for long.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function createMailer(from: string, transport: MailTransport): Mailer {
  return {
    async send({ to, subject, text, html, attachments, inlineImages }) {
      await transport.sendMail({
        from,
        to,
        subject,
        text,
        html,
        attachments: [
          ...attachments.map(({ filename, content, contentType }) => ({ filename, content, contentType })),
          ...inlineImages.map(({ cid, filename, content, contentType }) => ({ cid, filename, content, contentType, contentDisposition: 'inline' })),
        ],
      });
    },
  };
}
