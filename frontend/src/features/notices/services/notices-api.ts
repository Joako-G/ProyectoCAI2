import { request, sendJson } from '../../members/services/members-api';
import type { DebtNoticeList, WelcomeEmailSent, WelcomeNotice } from '../types/notice';

/** Members with debt as of today, each with a ready WhatsApp link when a usable number exists. */
export function fetchDebtNotices(signal?: AbortSignal): Promise<DebtNoticeList> {
  return request<DebtNoticeList>('/api/notices/debt', { signal });
}

/** The welcome for an enrollment payment, with a ready WhatsApp link when a usable number exists. */
export function fetchWelcomeNotice(paymentId: string, signal?: AbortSignal): Promise<WelcomeNotice> {
  return request<WelcomeNotice>(`/api/notices/welcome/${encodeURIComponent(paymentId)}`, { signal });
}

/** The server bounds a send to about 15 s; the client gives up a little later and treats that as an uncertain outcome. */
export const EMAIL_CLIENT_TIMEOUT_MS = 20_000;

/**
 * Emails the welcome with the receipt PDF attached. Resolves once the mail server accepted it. `resend: true` confirms
 * that an email already sent (or of unknown outcome) should go again. Rejects with an `AbortError` after 20 s.
 */
export async function sendWelcomeEmail(paymentId: string, { resend = false }: { resend?: boolean } = {}): Promise<WelcomeEmailSent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_CLIENT_TIMEOUT_MS);
  try {
    return await request<WelcomeEmailSent>(`/api/notices/welcome/${encodeURIComponent(paymentId)}/email`, {
      ...sendJson('POST', resend ? { resend: true } : undefined),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
