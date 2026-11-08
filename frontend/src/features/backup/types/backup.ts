/** `missing`: the configured folder is not there (for example an unplugged drive). `unreadable`: it exists but cannot be listed. */
export type DestinationState = 'ready' | 'missing' | 'unreadable';

/** The database part of a copy. `failed` has a short code only, never a message. Mirrors `BackupDatabasePart` in the backend. */
export type BackupDatabasePart =
  | { state: 'not_configured' }
  | { state: 'included'; file: 'database.dump'; format: 'pg_dump-custom'; bytes: number }
  | { state: 'failed'; code: string };

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
  database: {
    /** The database part of the newest copy; null while there is no copy. */
    lastCopy: BackupDatabasePart | null;
    /** The last failed dump since the server started and since the last good dump. */
    lastFailure: { at: string; code: string } | null;
  };
}

/** What `POST /api/backups` answers for a finished copy. `partial`: the files were copied but the database was not. */
export interface BackupResult {
  name: string;
  at: string;
  files: string[];
  database: BackupDatabasePart;
  partial: boolean;
}
