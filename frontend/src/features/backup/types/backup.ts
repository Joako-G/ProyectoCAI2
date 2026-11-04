/** Mirrors `BackupStatus` in backend/src/modules/backup/backup.types.ts. */
export interface BackupStatus {
  /** Whether the copies go to the default folder inside the project, which is not an external device. */
  destination: { isDefault: boolean };
  /** How many copies the server keeps. */
  keep: number;
  /** Copies present now. */
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
