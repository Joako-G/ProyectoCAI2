import { randomUUID } from 'node:crypto';
import { resolveEntityLabels, type AuditLabelSources } from './audit.labels.js';
import type { AuditRepository } from './audit.repository.js';
import type { AuditActor, AuditEntry, AuditRecordInput } from './audit.types.js';

/** The port the other modules write through. It never rejects: a failed audit write must not undo a change. */
export interface AuditRecorder {
  record(input: AuditRecordInput): Promise<void>;
}

/** For callers that make changes outside the audited flow (seeding) and in tests that ignore the log. */
export const discardAudit: AuditRecorder = { record: () => Promise.resolve() };

/** Looks an actor up by id to snapshot their name and role. */
export interface AuditActorDirectory {
  find(id: string): AuditActor | undefined;
}

export interface AuditServiceDeps {
  repository: AuditRepository;
  actors: AuditActorDirectory;
  /** Without sources every label is the short fallback. */
  labels?: AuditLabelSources;
  now?: () => Date;
  newId?: () => string;
}

/** Audit writes that failed since the server started: a count and the last time, never an error text or a record. */
export interface AuditFailures {
  count: number;
  /** ISO instant, or null while nothing has failed. */
  lastFailedAt: string | null;
}

/** An entry as the API shows it: the stored fields plus a readable name for the record, never stored. */
export type AuditEntryView = AuditEntry & { entityLabel: string };

export function createAuditService({ repository, actors, labels, now = () => new Date(), newId = randomUUID }: AuditServiceDeps) {
  // Kept in memory only: it resets when the server restarts, so it says "since the last start", not "ever".
  // The operator still has the console log for older failures.
  let failureCount = 0;
  let lastFailedAt: string | null = null;

  return {
    // The change is already committed when this runs, and the audit file cannot share its atomic write, so a
    // failure is logged and swallowed. Not `async`: the append starts before this returns, so a read queued
    // right after the call (the next request) always sees the entry.
    record(input: AuditRecordInput): Promise<void> {
      const fail = (error: unknown) => {
        failureCount += 1;
        lastFailedAt = now().toISOString();
        // Names the operation only: no ids, names or field values.
        console.error(`Could not write the audit entry for ${input.action} on ${input.entityType}`, error);
      };
      try {
        const found = actors.find(input.actorId);
        const entry: AuditEntry = {
          id: newId(),
          at: now().toISOString(),
          actor: found
            ? { id: found.id, name: found.name, role: found.role }
            : { id: input.actorId, name: input.actorId, role: 'unknown' },
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          changedFields: [...(input.changedFields ?? [])],
        };
        return repository.append(entry).catch(fail);
      } catch (error) {
        fail(error);
        return Promise.resolve();
      }
    },

    failures(): AuditFailures {
      return { count: failureCount, lastFailedAt };
    },

    // Newest first. Entries are appended in time order, so reversing keeps same-instant entries newest first too.
    async list(): Promise<AuditEntryView[]> {
      const entries = (await repository.list()).reverse();
      const entityLabels = await resolveEntityLabels(entries, labels);
      return entries.map((entry, index) => ({ ...entry, entityLabel: entityLabels[index]! }));
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
