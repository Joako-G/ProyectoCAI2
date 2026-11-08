import { request, sendJson } from '../../members/services/members-api';
import type { FaceStatus } from '../types/face';

const faceUrl = (memberId: string) => `/api/faces/${encodeURIComponent(memberId)}`;

/** Whether the member has a face enrolled. The server never returns the descriptor. */
export function getFaceStatus(memberId: string, signal?: AbortSignal): Promise<FaceStatus> {
  return request<FaceStatus>(faceUrl(memberId), { signal });
}

/** How many members have a face enrolled: a number only, for the client screen's "comparing with N members". */
export function getFaceSummary(signal?: AbortSignal): Promise<{ enrolled: number }> {
  return request<{ enrolled: number }>('/api/faces/summary', { signal });
}

/** Sends the 128-number descriptor and the confirmed consent. No image ever goes to the server. */
export function enrollFace(memberId: string, descriptor: readonly number[]): Promise<void> {
  return request<void>(faceUrl(memberId), sendJson('PUT', { descriptor, consent: true }));
}

export function removeFace(memberId: string): Promise<void> {
  return request<void>(faceUrl(memberId), { method: 'DELETE' });
}
