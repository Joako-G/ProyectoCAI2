import { request, sendJson } from '../../members/services/members-api';
import type { CashCount, CashCountPreview, CloseDayInput } from '../types/cashcount';

export function fetchPreview(signal?: AbortSignal): Promise<CashCountPreview> {
  return request<CashCountPreview>('/api/cashcount/today', { signal });
}

export function fetchHistory(signal?: AbortSignal): Promise<CashCount[]> {
  return request<CashCount[]>('/api/cashcount', { signal });
}

/** Closes today. The server decides the date, the actor, the expected totals and the difference. */
export function closeDay(input: CloseDayInput): Promise<CashCount> {
  return request<CashCount>('/api/cashcount', sendJson('POST', input));
}
