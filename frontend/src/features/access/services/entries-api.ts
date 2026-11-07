import { request } from '../../members/services/members-api';
import type { EntriesDay } from '../types/entries';

/** The entrance checks of today (club time), newest first. */
export async function fetchEntriesToday(signal?: AbortSignal): Promise<EntriesDay> {
  const day = await request<EntriesDay>('/api/access/entries', { signal });
  // A proxy or a mismatched server can answer something else; fail here instead of rendering garbage.
  if (typeof day !== 'object' || day === null || !Array.isArray(day.entries) || typeof day.count !== 'number') {
    throw new Error('Unexpected entries answer');
  }
  return day;
}
