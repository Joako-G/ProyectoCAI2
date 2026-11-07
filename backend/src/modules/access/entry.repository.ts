import type { AccessResult } from './access.types.js';

export type EntranceMethod = 'dni' | 'face';

/** What is written for one identified check. */
export interface EntryInput {
  memberId: string;
  result: AccessResult;
  /** The access reason code; never free text. */
  reason: string;
  method: EntranceMethod;
  /** ISO instant. */
  checkedAt: string;
  /** Id of the staff user who ran the check. */
  checkedBy: string;
}

export interface EntryRecord extends EntryInput {
  id: string;
}

/** The persistence contract of the entry log; the PostgreSQL adapter implements it. */
export interface EntryRepository {
  append(entry: EntryInput): Promise<void>;
  /** The entries of one club-time-zone calendar day (YYYY-MM-DD), newest first. */
  listByDate(date: string): Promise<EntryRecord[]>;
}
