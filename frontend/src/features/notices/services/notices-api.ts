import { request } from '../../members/services/members-api';
import type { DebtNoticeList, WelcomeNotice } from '../types/notice';

/** Members with debt as of today, each with a ready WhatsApp link when a usable number exists. */
export function fetchDebtNotices(signal?: AbortSignal): Promise<DebtNoticeList> {
  return request<DebtNoticeList>('/api/notices/debt', { signal });
}

/** The welcome for an enrollment payment, with a ready WhatsApp link when a usable number exists. */
export function fetchWelcomeNotice(paymentId: string, signal?: AbortSignal): Promise<WelcomeNotice> {
  return request<WelcomeNotice>(`/api/notices/welcome/${encodeURIComponent(paymentId)}`, { signal });
}
