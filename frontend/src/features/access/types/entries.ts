import type { AccessResult } from './access';

/** Mirrors `EntriesDay` in backend/src/modules/access/access.entries.ts. */
export interface EntryView {
  id: string;
  /** ISO instant of the check. */
  checkedAt: string;
  /** Null when the member no longer exists. */
  memberNumber: string | null;
  name: string | null;
  method: 'dni' | 'face';
  result: AccessResult;
}

export interface EntriesDay {
  date: string;
  /** Members who entered: green and yellow checks. */
  count: number;
  entries: EntryView[];
}
