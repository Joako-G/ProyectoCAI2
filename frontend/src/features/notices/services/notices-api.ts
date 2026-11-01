import { request } from '../../members/services/members-api';
import type { DebtNoticeList } from '../types/notice';

/** Members with debt as of today, each with a ready WhatsApp link when a usable number exists. */
export function fetchDebtNotices(signal?: AbortSignal): Promise<DebtNoticeList> {
  return request<DebtNoticeList>('/api/notices/debt', { signal });
}
