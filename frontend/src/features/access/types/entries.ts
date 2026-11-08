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

export interface DayCounts {
  entered: number;
  warned: number;
  refused: number;
}

export interface EntriesDay {
  date: string;
  /** Checks that let someone in: green and yellow. A person checked twice counts twice. */
  count: number;
  /** Different members who entered at least once today. */
  distinctMembers: number;
  /** The day by result: `entered` is green plus yellow, `warned` is yellow, `refused` is red. */
  counts: DayCounts;
  entries: EntryView[];
}
