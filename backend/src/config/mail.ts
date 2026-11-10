/** How the club's mailbox is reached over SMTP. Read from the environment; nothing here is ever logged. */
export interface MailConfig {
  host: string;
  port: number;
  /** True for an implicit-TLS connection (usually port 465); false for STARTTLS or plain (587). */
  secure: boolean;
  /** Both present or both absent. */
  auth?: { user: string; password: string };
  /** The sender, for example `Secretaría <secretaria@club.example>`. */
  from: string;
}

export type MailConfigResult =
  | { state: 'configured'; config: MailConfig }
  | { state: 'not_configured' }
  /** Some variables are set but not usable; the names are safe to log, the values are not. */
  | { state: 'invalid'; problems: string[] };

const SECURE = /^(true|1|yes)$/i;
const NOT_SECURE = /^(false|0|no)$/i;

/** SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD and MAIL_FROM. Without SMTP_HOST the feature is off. */
export function mailConfig(env: NodeJS.ProcessEnv = process.env): MailConfigResult {
  const host = env.SMTP_HOST?.trim();
  if (!host) return { state: 'not_configured' };
  const problems: string[] = [];

  const from = env.MAIL_FROM?.trim();
  if (!from) problems.push('MAIL_FROM is missing');

  const secureRaw = env.SMTP_SECURE?.trim();
  let secure = false;
  if (secureRaw) {
    if (SECURE.test(secureRaw)) secure = true;
    else if (!NOT_SECURE.test(secureRaw)) problems.push('SMTP_SECURE must be true or false');
  }

  const portRaw = env.SMTP_PORT?.trim();
  let port = secure ? 465 : 587;
  if (portRaw) {
    port = Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('SMTP_PORT is not a valid port');
  }

  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(password)) problems.push('SMTP_USER and SMTP_PASSWORD must be set together');

  if (problems.length > 0 || !from) return { state: 'invalid', problems };
  return { state: 'configured', config: { host, port, secure, from, ...(user && password ? { auth: { user, password } } : {}) } };
}
