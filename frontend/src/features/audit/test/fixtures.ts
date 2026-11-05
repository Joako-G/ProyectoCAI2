import type { AuditEntry } from '../types/audit';

export function buildEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'entry-1',
    at: '2026-11-01T15:30:00.000Z',
    actor: { id: 'user-head', name: 'Ana Prueba', role: 'head_secretary' },
    action: 'update',
    entityType: 'member',
    entityId: 'member-1',
    entityLabel: 'Socio 0007',
    changedFields: ['category', 'whatsapp'],
    ...overrides,
  };
}
