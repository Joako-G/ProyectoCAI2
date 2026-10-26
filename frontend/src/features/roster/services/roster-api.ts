import { request } from '../../members/services/members-api';
import type { DisciplineRoster } from '../types/roster';

/** The signed-in teacher's rosters; the server resolves the disciplines from the session. */
export function fetchRoster(signal?: AbortSignal): Promise<DisciplineRoster[]> {
  return request<DisciplineRoster[]>('/api/roster', { signal });
}
