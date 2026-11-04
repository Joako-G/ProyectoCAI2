/** One data file the backup copies: `name` is how it is stored in the copy, `path` where it lives now. */
export interface BackupSource {
  name: string;
  path: string;
}

/** A finished copy. `files` lists what was copied; a file that does not exist yet is not an error and not listed. */
export interface BackupResult {
  /** The folder name, which is also the entity id in the audit log. */
  name: string;
  /** ISO instant of the copy. */
  at: string;
  files: string[];
}

/** Why a copy failed, as a short code (a system error code such as `ENOSPC`, or `NO_FILES`): never a message or a path. */
export interface BackupFailure {
  /** ISO instant of the attempt. */
  at: string;
  code: string;
}

export type BackupRun = { ok: true; backup: BackupResult } | { ok: false; failure: BackupFailure };

export interface BackupStatus {
  /** Whether the copies go to the default folder inside the project, which is not an external device. */
  destination: { isDefault: boolean };
  /** How many copies are kept; older ones are deleted after a good copy. */
  keep: number;
  /** Copies present in the destination now. */
  copies: number;
  /** ISO instant of the newest copy, read from the destination so it survives a restart; null while there is none. */
  lastSuccessAt: string | null;
  /** The last failed attempt since the server started and since the last good copy, or null. */
  lastFailure: BackupFailure | null;
  running: boolean;
}
