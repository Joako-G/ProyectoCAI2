import { request, sendJson } from '../../members/services/members-api';
import type { AccessCheck } from '../types/access';

/** Whether the member with this DNI may enter today. The DNI goes in the body, never in the URL. */
export function checkAccess(dni: string, signal?: AbortSignal): Promise<AccessCheck> {
  return request<AccessCheck>('/api/access/check', { ...sendJson('POST', { dni }), signal });
}
