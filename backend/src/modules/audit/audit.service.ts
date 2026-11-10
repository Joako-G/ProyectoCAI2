import { randomUUID } from 'node:crypto';
import { toIsoDate } from '../../shared/date.js';
import { resolveEntityLabels, type AuditLabelSources } from './audit.labels.js';
import type { AuditRepository } from './audit.repository.js';
import type { AuditActor, AuditEntry, AuditQuery, AuditRecordInput } from './audit.types.js';

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

type EntryMatcher = (entry: AuditEntry) => boolean;

/**
 * Member filter, resolved at read time like the labels: nothing about members is stored in the log. A member
 * matches its own `member` and `face_profile` entries (keyed by the member id) and the payments it owns.
 * An unknown number, or a source that cannot be read, matches nothing.
 */
async function memberMatcher(memberNumber: string | undefined, sources?: AuditLabelSources): Promise<EntryMatcher | undefined> {
  if (memberNumber === undefined) return undefined;
  const none: EntryMatcher = () => false;
  if (!sources) return none;
  try {
    const member = (await sources.members()).find((row) => Number(row.memberNumber) === Number(memberNumber));
    if (!member) return none;
    const paymentIds = new Set((await sources.payments()).filter((payment) => payment.memberId === member.id).map((payment) => payment.id));
    return ({ entityType, entityId }) =>
      ((entityType === 'member' || entityType === 'face_profile') && entityId === member.id) || (entityType === 'payment' && paymentIds.has(entityId));
  } catch (error) {
    console.error('Could not read the member records to filter the audit log', error);
    return none;
  }
}

/** Club-local day of a stored instant, or undefined when it is not a valid date. */
function entryDay(at: string): string | undefined {
  const instant = new Date(at);
  return Number.isNaN(instant.getTime()) ? undefined : toIsoDate(instant);
}

function filterEntries(entries: AuditEntry[], { actorId, entityType, action, from, to }: AuditQuery, belongsToMember?: EntryMatcher): AuditEntry[] {
  return entries.filter((entry) => {
    if (actorId !== undefined && entry.actor.id !== actorId) return false;
    if (entityType !== undefined && entry.entityType !== entityType) return false;
    if (action !== undefined && entry.action !== action) return false;
    if (belongsToMember && !belongsToMember(entry)) return false;
    if (from !== undefined || to !== undefined) {
      const day = entryDay(entry.at);
      if (day === undefined || (from !== undefined && day < from) || (to !== undefined && day > to)) return false;
    }
    return true;
  });
}

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
    // Filters run before labels are resolved, so only the sources the remaining entries need are read.
    async list(query: AuditQuery = {}): Promise<AuditEntryView[]> {
      const entries = filterEntries((await repository.list()).reverse(), query, await memberMatcher(query.member, labels));
      const entityLabels = await resolveEntityLabels(entries, labels);
      return entries.map((entry, index) => ({ ...entry, entityLabel: entityLabels[index]! }));
    },

    // The distinct actors of the whole log, as they were at their latest entry, for the user filter.
    async actors(): Promise<AuditActor[]> {
      const latest = new Map<string, AuditActor>();
      for (const { actor } of (await repository.list()).reverse()) {
        if (!latest.has(actor.id)) latest.set(actor.id, { id: actor.id, name: actor.name, role: actor.role });
      }
      return [...latest.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
