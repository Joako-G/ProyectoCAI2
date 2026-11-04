import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConflictError } from '../../shared/errors.js';
import type { AuditRecorder } from '../audit/audit.service.js';
import { copyFolderInstant, copyFolderName, isCopyFolder, isPartialFolder, partialFolderName } from './backup.naming.js';
import type { BackupFailure, BackupRun, BackupSource, BackupStatus } from './backup.types.js';

const DEFAULT_KEEP = 30;
const MANIFEST = 'manifest.json';

export interface BackupServiceDeps {
  sources: readonly BackupSource[];
  /** The folder that holds the dated copies; it can be on an external drive. */
  destination: string;
  isDefaultDestination: boolean;
  /** How many copies to keep. */
  keep?: number;
  audit: AuditRecorder;
  now?: () => Date;
}

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'UNKNOWN';

class NoFilesError extends Error {
  readonly code = 'NO_FILES';
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

export function createBackupService({ sources, destination, isDefaultDestination, keep = DEFAULT_KEEP, audit, now = () => new Date() }: BackupServiceDeps) {
  let running = false;
  // In memory: it resets on restart. The last good copy does not depend on it, because it is read from the folders.
  let lastFailure: BackupFailure | null = null;

  // Only the module's own folders, oldest first. A destination that cannot be read has no copies to show.
  async function listCopies(): Promise<string[]> {
    try {
      const entries = await readdir(destination, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory() && isCopyFolder(entry.name)).map((entry) => entry.name).sort();
    } catch {
      return [];
    }
  }

  async function removeLeftovers(): Promise<void> {
    const entries = await readdir(destination, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && isPartialFolder(entry.name)) await rm(join(destination, entry.name), { recursive: true, force: true });
    }
  }

  async function applyRetention(): Promise<void> {
    const copies = await listCopies();
    for (const name of copies.slice(0, Math.max(0, copies.length - keep))) {
      await rm(join(destination, name), { recursive: true, force: true });
    }
  }

  // Builds the copy in a partial folder and renames it last, so a copy exists under its final name only when complete.
  async function copy(actorId: string | undefined): Promise<BackupRun> {
    const at = now();
    const name = copyFolderName(at);
    const finalPath = join(destination, name);
    const partialPath = join(destination, partialFolderName(name));
    try {
      await mkdir(destination, { recursive: true });
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
      await writeFile(join(partialPath, MANIFEST), `${JSON.stringify({ createdAt: at.toISOString(), files }, null, 2)}\n`);
      await rename(partialPath, finalPath);
      lastFailure = null;
      try {
        await applyRetention();
      } catch (error) {
        // The new copy is good; a copy that could not be deleted only waits for the next run.
        console.error(`Could not remove old backups (${errorCode(error)})`);
      }
      if (actorId) await audit.record({ actorId, action: 'create', entityType: 'backup', entityId: name });
      return { ok: true, backup: { name, at: at.toISOString(), files } };
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
      const copies = await listCopies();
      const newest = copies.at(-1);
      return {
        destination: { isDefault: isDefaultDestination },
        keep,
        copies: copies.length,
        lastSuccessAt: newest ? (copyFolderInstant(newest)?.toISOString() ?? null) : null,
        lastFailure,
        running,
      };
    },
  };
}

export type BackupService = ReturnType<typeof createBackupService>;
