/** One data file the backup copies: `name` is how it is stored in the copy, `path` where it lives now. */
export interface BackupSource {
  name: string;
  path: string;
}

/**
 * The database part of one copy, also stored in its manifest. `failed` carries a short code
 * (`DATABASE_DUMP_FAILED`, `DATABASE_DUMP_UNAVAILABLE`): never a message, a path or any content of the dump.
 */
export type BackupDatabasePart =
  | { state: 'not_configured' }
  | { state: 'included'; file: 'database.dump'; format: 'pg_dump-custom'; bytes: number }
  | { state: 'failed'; code: string };

/** A finished copy. `files` lists what was copied; a file that does not exist yet is not an error and not listed. */
export interface BackupResult {
  /** The folder name, which is also the entity id in the audit log. */
  name: string;
  /** ISO instant of the copy. */
  at: string;
  files: string[];
  database: BackupDatabasePart;
  /** True when the JSON files were copied but the database dump failed: the copy exists but is not complete. */
  partial: boolean;
}

/** Why a copy failed, as a short code (a system error code such as `ENOSPC`, `NO_FILES`, or `DESTINATION_MISSING`): never a message or a path. */
export interface BackupFailure {
  /** ISO instant of the attempt. */
  at: string;
  code: string;
}

export type BackupRun = { ok: true; backup: BackupResult } | { ok: false; failure: BackupFailure };

/**
 * What reading the destination found. `missing`: a configured folder that is not there (for example an unplugged drive).
 * `unreadable`: it exists but cannot be listed. A default folder that is not created yet is `ready` with no copies.
 */
export type DestinationState = 'ready' | 'missing' | 'unreadable';

export interface BackupStatus {
  /** Whether the copies go to the default folder inside the project, which is not an external device. */
  destination: { isDefault: boolean; state: DestinationState };
  /** Days with copies whose newest copy is kept; older days are deleted after a good copy. */
  keep: number;
  /** The newest copies kept whatever their day, so several copies in one day never push out older days. */
  keepRecent: number;
  /** Copies present in the destination now; 0 when the destination is missing or unreadable. */
  copies: number;
  /** ISO instant of the newest copy, read from the destination so it survives a restart; null while there is none. */
  lastSuccessAt: string | null;
  /** The last failed attempt since the server started and since the last good copy, or null. */
  lastFailure: BackupFailure | null;
  running: boolean;
  database: {
    /** The database part of the newest copy, read from its manifest; null while there is no copy. */
    lastCopy: BackupDatabasePart | null;
    /** The last failed dump since the server started and since the last good dump, or null. */
    lastFailure: BackupFailure | null;
  };
}
