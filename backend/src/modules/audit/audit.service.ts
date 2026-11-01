import { randomUUID } from 'node:crypto';
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
  now?: () => Date;
  newId?: () => string;
}

export function createAuditService({ repository, actors, now = () => new Date(), newId = randomUUID }: AuditServiceDeps) {
  return {
    // The change is already committed when this runs, and the audit file cannot share its atomic write, so a
    // failure is logged and swallowed. Not `async`: the append starts before this returns, so a read queued
    // right after the call (the next request) always sees the entry.
    record(input: AuditRecordInput): Promise<void> {
      const fail = (error: unknown) => {
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

    // Newest first. Entries are appended in time order, so reversing keeps same-instant entries newest first too.
    async list(): Promise<AuditEntry[]> {
      return (await repository.list()).reverse();
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
