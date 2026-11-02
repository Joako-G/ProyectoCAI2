import { request } from '../../members/services/members-api';
import type { AuditEntry } from '../types/audit';

/** The whole audit log, newest first. Read-only: the server has no way to change it. */
export function fetchAuditLog(signal?: AbortSignal): Promise<AuditEntry[]> {
  return request<AuditEntry[]>('/api/audit', { signal });
}
