import { createJsonStore } from '../../database/json-store.js';
import type { AuditRepository } from './audit.repository.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditEntry } from './audit.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWellShaped(value: unknown): value is AuditEntry {
  if (!isRecord(value)) return false;
  if (!['id', 'at', 'entityId'].every((field) => typeof value[field] === 'string')) return false;
  if (!(AUDIT_ACTIONS as readonly unknown[]).includes(value.action)) return false;
  if (!(AUDIT_ENTITY_TYPES as readonly unknown[]).includes(value.entityType)) return false;
  if (!Array.isArray(value.changedFields) || !value.changedFields.every((field) => typeof field === 'string')) return false;
  const { actor } = value;
  return isRecord(actor) && ['id', 'name', 'role'].every((field) => typeof actor[field] === 'string');
}

export function createJsonAuditRepository(filePath: string): AuditRepository {
  const store = createJsonStore<AuditEntry[]>(filePath, []);

  // A parsed-but-wrong shape must never reach an append: writing back would destroy the file.
  function assertEntries(value: unknown): AuditEntry[] {
    if (!Array.isArray(value) || !value.every(isWellShaped)) {
      throw new Error(`Invalid audit file ${filePath}: it must contain a JSON array of audit entries`);
    }
    return value;
  }

  return {
    list: async () => assertEntries(await store.read()),
    async append(entry) {
      await store.update((current) => [...assertEntries(current), entry]);
    },
  };
}
