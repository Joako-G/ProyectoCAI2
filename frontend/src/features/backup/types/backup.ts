/** `missing`: the configured folder is not there (for example an unplugged drive). `unreadable`: it exists but cannot be listed. */
export type DestinationState = 'ready' | 'missing' | 'unreadable';

/** Mirrors `BackupStatus` in backend/src/modules/backup/backup.types.ts. */
export interface BackupStatus {
  /** Whether the copies go to the default folder inside the project, which is not an external device. */
  destination: { isDefault: boolean; state: DestinationState };
  /** Days with copies whose newest copy the server keeps. */
  keep: number;
  /** The newest copies the server keeps whatever their day. */
  keepRecent: number;
  /** Copies present now; 0 when the destination is missing or unreadable. */
  copies: number;
  /** ISO instant of the newest copy, or null while there is none. */
  lastSuccessAt: string | null;
  /** The last failed attempt since the server started and since the last good copy. */
  lastFailure: { at: string; code: string } | null;
  running: boolean;
}

/** What `POST /api/backups` answers for a finished copy. */
export interface BackupResult {
  name: string;
  at: string;
  files: string[];
}
