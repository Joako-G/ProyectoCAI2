import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditService, type AuditActorDirectory, type AuditRecorder } from '../../src/modules/audit/audit.service.js';
import { createJsonAuditRepository } from '../../src/modules/audit/json-audit.repository.js';

/** A recorder for tests that do not care about the audit log. */
export const noAudit: AuditRecorder = { record: async () => undefined };

export const HEAD_ACTOR = { id: 'user-head', name: 'Ana Gómez', role: 'head_secretary' };
export const SECRETARY_ACTOR = { id: 'user-secretary', name: 'Luis Pérez', role: 'secretary' };

/** Resolves the two synthetic actors above; anyone else is unknown. */
export const actors: AuditActorDirectory = {
  find: (id) => [HEAD_ACTOR, SECRETARY_ACTOR].find((actor) => actor.id === id),
};

/** The real audit service over a temporary file, with a fixed clock and predictable ids. */
export async function createTestContext(options: { now?: () => Date } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'audit-'));
  const file = join(dir, 'audit.json');
  const repository = createJsonAuditRepository(file);
  let sequence = 0;
  const service = createAuditService({
    repository,
    actors,
    now: options.now ?? (() => new Date('2026-11-01T15:00:00Z')),
    newId: () => `entry-${++sequence}`,
  });
  return { service, repository, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
