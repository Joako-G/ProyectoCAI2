import { request, sendJson } from '../../members/services/members-api';
import type { AccessCheck } from '../types/access';

/** Whether the member with this DNI may enter today. The DNI goes in the body, never in the URL. */
export function checkAccess(dni: string, signal?: AbortSignal): Promise<AccessCheck> {
  return request<AccessCheck>('/api/access/check', { ...sendJson('POST', { dni }), signal });
}

/** Whom the camera sees: only the 128-number descriptor is sent, never an image. Answers like the DNI check. */
export function recognizeAccess(descriptor: readonly number[], signal?: AbortSignal): Promise<AccessCheck> {
  return request<AccessCheck>('/api/faces/recognize', { ...sendJson('POST', { descriptor }), signal });
}
