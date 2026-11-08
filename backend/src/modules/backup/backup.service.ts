import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toIsoDate } from '../../shared/date.js';
import { ConflictError } from '../../shared/errors.js';
import type { AuditRecorder } from '../audit/audit.service.js';
import { copyFolderInstant, copyFolderName, isCopyFolder, isPartialFolder, partialFolderName } from './backup.naming.js';
import { DumpError, type DatabaseDumper } from './backup.dump.js';
import type { BackupDatabasePart, BackupFailure, DatabaseFailureCode, BackupRun, BackupSource, BackupStatus, DestinationState } from './backup.types.js';

const DEFAULT_KEEP = 30;
const DEFAULT_KEEP_RECENT = 5;
const MANIFEST = 'manifest.json';
const FAILURE_CODES: readonly DatabaseFailureCode[] = ['DATABASE_DUMP_FAILED', 'DATABASE_DUMP_UNAVAILABLE'];
const DUMP_FILE = 'database.dump';
// The dump is written under this name and renamed when complete, so `database.dump` only ever exists whole.
const DUMP_TEMP_FILE = 'database.dump.tmp';

export interface BackupServiceDeps {
  sources: readonly BackupSource[];
  /** Takes the PostgreSQL dump; absent when there is no DATABASE_URL, and then the copy is the JSON files only. */
  database?: DatabaseDumper;
  /** The folder that holds the dated copies; it can be on an external drive. */
  destination: string;
  isDefaultDestination: boolean;
  /** How many calendar days (club time zone) keep their newest copy. */
  keep?: number;
  /** How many of the newest copies are kept whatever their day. */
  keepRecent?: number;
  audit: AuditRecorder;
  now?: () => Date;
}

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'UNKNOWN';

class NoFilesError extends Error {
  readonly code = 'NO_FILES';
}

class DestinationMissingError extends Error {
  readonly code = 'DESTINATION_MISSING';
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

/** A copy is good when its database is in it or was never expected. A failed dump, or a manifest that cannot be read, is not good. */
const isGood = (part: BackupDatabasePart | null): boolean => part !== null && part.state !== 'failed';

/** The database part stored in a copy's manifest. A copy from before the dump existed has none: it is "not configured". */
async function readDatabasePart(copyPath: string): Promise<BackupDatabasePart | null> {
  try {
    const manifest: unknown = JSON.parse(await readFile(join(copyPath, MANIFEST), 'utf8'));
    const part = typeof manifest === 'object' && manifest !== null ? (manifest as { database?: BackupDatabasePart }).database : undefined;
    if (part && typeof part === 'object' && part.state === 'failed') {
      return { state: 'failed', code: (FAILURE_CODES as readonly string[]).includes(part.code) ? part.code : 'DATABASE_DUMP_FAILED' };
    }
    return part && typeof part === 'object' && ['included', 'not_configured'].includes(part.state) ? part : { state: 'not_configured' };
  } catch {
    return null;
  }
}

export function createBackupService({ sources, database, destination, isDefaultDestination, keep = DEFAULT_KEEP, keepRecent = DEFAULT_KEEP_RECENT, audit, now = () => new Date() }: BackupServiceDeps) {
  let running = false;
  // In memory: it resets on restart. The last good copy does not depend on it, because it is read from the folders.
  let lastFailure: BackupFailure | null = null;
  let lastDumpFailure: BackupFailure | null = null;

  // Only the module's own folders with a real date, oldest first. A destination that cannot be read is reported as such, never as empty.
  async function readDestination(): Promise<{ state: DestinationState; copies: string[] }> {
    try {
      const entries = await readdir(destination, { withFileTypes: true });
      return { state: 'ready', copies: entries.filter((entry) => entry.isDirectory() && isCopyFolder(entry.name)).map((entry) => entry.name).sort() };
    } catch (error) {
      // The default folder is created by the first copy, so it is not a problem that it is not there yet.
      if (errorCode(error) === 'ENOENT') return { state: isDefaultDestination ? 'ready' : 'missing', copies: [] };
      return { state: 'unreadable', copies: [] };
    }
  }

  async function removeLeftovers(): Promise<void> {
    const entries = await readdir(destination, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && isPartialFolder(entry.name)) await rm(join(destination, entry.name), { recursive: true, force: true });
    }
  }

  // Keeps, for each of the `keep` most recent club days that have copies, the newest copy with a good database part (the
  // newest copy of the day when none has one); the newest copy with a good database part overall, whatever its age, so a run
  // of failed dumps never removes the last restorable database; and the `keepRecent` newest copies whatever their day.
  // `justMade` is never deleted. A folder that is not a real copy is not listed, so it is never deleted. A manifest that
  // cannot be read counts as not good, and such a copy is deleted only when a rule above leaves it out.
  async function applyRetention(justMade: string): Promise<void> {
    const { state, copies } = await readDestination();
    if (state !== 'ready') return;
    const kept = new Set<string>([justMade, ...copies.slice(-keepRecent)]);
    const good = new Map<string, boolean>();
    for (const name of copies) good.set(name, isGood(await readDatabasePart(join(destination, name))));
    const newestGood = [...copies].reverse().find((name) => good.get(name));
    if (newestGood) kept.add(newestGood);
    const chosenOfDay = new Map<string, string>();
    for (const name of [...copies].reverse()) {
      const day = toIsoDate(copyFolderInstant(name)!);
      const chosen = chosenOfDay.get(day);
      if (chosen === undefined) {
        if (chosenOfDay.size < keep) chosenOfDay.set(day, name);
      } else if (!good.get(chosen) && good.get(name)) {
        chosenOfDay.set(day, name);
      }
    }
    for (const name of chosenOfDay.values()) kept.add(name);
    for (const name of copies) {
      if (!kept.has(name)) await rm(join(destination, name), { recursive: true, force: true });
    }
  }

  // Dumps the database into the partial folder. A failed dump never fails the copy: the JSON files are still worth keeping,
  // so the copy is reported as partial with a code and no dump file is left behind.
  async function dumpDatabase(partialPath: string, at: Date): Promise<BackupDatabasePart> {
    if (!database) return { state: 'not_configured' };
    const temp = join(partialPath, DUMP_TEMP_FILE);
    try {
      const { bytes } = await database.dump(temp);
      await rename(temp, join(partialPath, DUMP_FILE));
      lastDumpFailure = null;
      return { state: 'included', file: DUMP_FILE, format: 'pg_dump-custom', bytes };
    } catch (error) {
      await rm(temp, { force: true }).catch(() => undefined);
      const code = error instanceof DumpError ? error.code : 'DATABASE_DUMP_FAILED';
      lastDumpFailure = { at: at.toISOString(), code };
      // The code and the sanitized tail of the tool's message: never a connection string, a password or dump content.
      console.error(`Database dump failed (${code})${error instanceof DumpError && error.detail ? `: ${error.detail}` : ''}`);
      return { state: 'failed', code };
    }
  }

  // Builds the copy in a partial folder and renames it last, so a copy exists under its final name only when complete.
  async function copy(actorId: string | undefined): Promise<BackupRun> {
    const at = now();
    const name = copyFolderName(at);
    const finalPath = join(destination, name);
    const partialPath = join(destination, partialFolderName(name));
    try {
      // A configured folder (an external drive) must already be there: creating it would write to the wrong place.
      if (isDefaultDestination) await mkdir(destination, { recursive: true });
      else if (!(await exists(destination))) throw new DestinationMissingError();
      if (await exists(finalPath)) throw new ConflictError('A backup was already made at this moment');
      await removeLeftovers();
      await mkdir(partialPath);
      const files: string[] = [];
      for (const source of sources) {
        try {
          await copyFile(source.path, join(partialPath, source.name));
          files.push(source.name);
        } catch (error) {
          // A file the app has not created yet is normal, for example the cash counts before the first close.
          if (errorCode(error) !== 'ENOENT') throw error;
        }
      }
      if (files.length === 0) throw new NoFilesError();
      const databasePart = await dumpDatabase(partialPath, at);
      await writeFile(join(partialPath, MANIFEST), `${JSON.stringify({ createdAt: at.toISOString(), files, database: databasePart }, null, 2)}\n`);
      await rename(partialPath, finalPath);
      lastFailure = null;
      try {
        await applyRetention(name);
      } catch (error) {
        // The new copy is good; a copy that could not be deleted only waits for the next run.
        console.error(`Could not remove old backups (${errorCode(error)})`);
      }
      if (actorId) await audit.record({ actorId, action: 'create', entityType: 'backup', entityId: name });
      return { ok: true, backup: { name, at: at.toISOString(), files, database: databasePart, partial: databasePart.state === 'failed' } };
    } catch (error) {
      await rm(partialPath, { recursive: true, force: true }).catch(() => undefined);
      if (error instanceof ConflictError) throw error;
      lastFailure = { at: at.toISOString(), code: errorCode(error) };
      // The code only: no paths, file names or content.
      console.error(`Backup failed (${lastFailure.code})`);
      return { ok: false, failure: lastFailure };
    }
  }

  return {
    // Copies every data file. `actorId` is the person who asked; an automatic copy has none and writes no audit entry.
    // A failed copy is returned, not thrown, and never removes an older copy. A copy already running is a conflict.
    async run(actorId?: string): Promise<BackupRun> {
      if (running) throw new ConflictError('A backup is already running');
      running = true;
      try {
        return await copy(actorId);
      } finally {
        running = false;
      }
    },

    async status(): Promise<BackupStatus> {
      const { state, copies } = await readDestination();
      const newest = copies.at(-1);
      let lastGood: string | undefined;
      for (const name of [...copies].reverse()) {
        if (isGood(await readDatabasePart(join(destination, name)))) {
          lastGood = name;
          break;
        }
      }
      return {
        destination: { isDefault: isDefaultDestination, state },
        keep,
        keepRecent,
        copies: copies.length,
        lastSuccessAt: newest ? (copyFolderInstant(newest)?.toISOString() ?? null) : null,
        lastGoodAt: lastGood ? (copyFolderInstant(lastGood)?.toISOString() ?? null) : null,
        lastFailure,
        running,
        database: { lastCopy: newest ? await readDatabasePart(join(destination, newest)) : null, lastFailure: lastDumpFailure },
      };
    },
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
