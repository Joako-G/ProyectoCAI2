import { ApiError, request, sendJson } from '../../members/services/members-api';
import type { Charge, MemberAccount, Payment, PreviewRequest, RegisterRequest } from '../types/payment';

// The HTTP plumbing and error contract are shared with the members client.
export { ApiError };

const BASE = '/api/payments';

const memberUrl = (memberId: string) => `${BASE}/members/${encodeURIComponent(memberId)}`;

export function fetchAccount(memberId: string, signal?: AbortSignal): Promise<MemberAccount> {
  return request<MemberAccount>(`${memberUrl(memberId)}/account`, { signal });
}

export function fetchHistory(memberId: string, signal?: AbortSignal): Promise<Payment[]> {
  return request<Payment[]>(memberUrl(memberId), { signal });
}

/** The server prices the concepts; nothing is written. */
export function previewCharge(body: PreviewRequest): Promise<Charge> {
  return request<Charge>(`${BASE}/preview`, sendJson('POST', body));
}

/** Registers a payment; the server recomputes every amount and allocates the receipt number. */
export function registerPayment(body: RegisterRequest): Promise<Payment> {
  return request<Payment>(BASE, sendJson('POST', body));
}

export function annulPayment(id: string, reason: string): Promise<Payment> {
  return request<Payment>(`${BASE}/${encodeURIComponent(id)}/annul`, sendJson('POST', { reason }));
}
