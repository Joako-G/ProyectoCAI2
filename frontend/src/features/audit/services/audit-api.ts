import { request } from '../../members/services/members-api';
import type { AuditLog } from '../types/audit';

/** The whole audit log, newest first, with the failed-write tally. Read-only: the server has no way to change it. */
export function fetchAuditLog(signal?: AbortSignal): Promise<AuditLog> {
  return request<AuditLog>('/api/audit', { signal });
}
