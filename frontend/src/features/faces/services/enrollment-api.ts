import { request, sendJson } from '../../members/services/members-api';
import type { EnrollmentProgressReport, EnrollmentSession } from '../types/enrollment';

const BASE = '/api/faces/enrollments';
const sessionUrl = (id: string, action = '') => `${BASE}/${encodeURIComponent(id)}${action}`;

/** Whether a public screen is connected, so the staff screen knows the enrollment can be guided there. */
export function getEnrollmentDisplay(signal?: AbortSignal): Promise<{ connected: boolean }> {
  return request<{ connected: boolean }>(`${BASE}/display`, { signal });
}

/** The session being run, if any; a public screen asks it when it (re)connects so it never misses a start. */
export function getActiveEnrollment(signal?: AbortSignal): Promise<{ session: EnrollmentSession | null }> {
  return request<{ session: EnrollmentSession | null }>(`${BASE}/active`, { signal });
}

/** Staff confirmed the member's consent: opens the session and tells the public screen to start. */
export async function openEnrollment(memberId: string): Promise<EnrollmentSession> {
  const { session } = await request<{ session: EnrollmentSession }>(BASE, sendJson('POST', { memberId, consent: true }));
  return session;
}

export function getEnrollment(id: string, signal?: AbortSignal): Promise<EnrollmentSession> {
  return request<EnrollmentSession>(sessionUrl(id), { signal });
}

/** The public screen reports what the member sees, or that it cannot capture. */
export function reportEnrollmentProgress(id: string, report: EnrollmentProgressReport): Promise<EnrollmentSession> {
  return request<EnrollmentSession>(sessionUrl(id, '/progress'), sendJson('POST', report));
}

/** The public screen delivers the mean descriptor; consent was confirmed when the session opened. */
export function completeEnrollment(id: string, descriptor: readonly number[]): Promise<void> {
  return request<void>(sessionUrl(id, '/complete'), sendJson('POST', { descriptor }));
}

export function cancelEnrollment(id: string): Promise<void> {
  return request<void>(sessionUrl(id, '/cancel'), sendJson('POST'));
}
