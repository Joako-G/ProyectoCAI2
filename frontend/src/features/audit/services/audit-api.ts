import { request } from '../../members/services/members-api';
import type { AuditFilters, AuditLog } from '../types/audit';
import { filtersToParams } from '../utils/audit-filters';

/** The URL of the log for a set of filters; without filters it is the plain list. */
export function auditUrl(filters: AuditFilters): string {
  const query = filtersToParams(filters).toString();
  return query ? `/api/audit?${query}` : '/api/audit';
}

/** The audit log, newest first, narrowed by the filters, with the failed-write tally. Read-only: the server has no way to change it. */
export async function fetchAuditLog(filters: AuditFilters, signal?: AbortSignal): Promise<AuditLog> {
  const log = await request<AuditLog>(auditUrl(filters), { signal });
  // An older server answers without the actors; the screen then offers no user to pick.
  return { ...log, actors: log.actors ?? [] };
}
