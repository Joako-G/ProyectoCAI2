export const AUDIT_ACTIONS = ['create', 'update', 'deactivate', 'reactivate', 'delete', 'annul', 'close'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  'member',
  'discipline',
  'user',
  'tariff',
  'surcharge_tiers',
  'proration_rule',
  'payment',
  'cash_count',
  'backup',
  'face_profile',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Who did it, as they were when they did it: a user's name can change later. */
export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

/**
 * One operation (RF-27). The log is append-only (RNF-08): there is no edit or delete. It names the record and
 * the fields that changed, never their values, so it holds no personal data, passwords or free-text reasons.
 */
export interface AuditEntry {
  id: string;
  /** ISO instant. */
  at: string;
  actor: AuditActor;
  action: AuditAction;
  entityType: AuditEntityType;
  /** The record's id; for a tariff, the month it starts; for the singleton configuration rows, the entity type. */
  entityId: string;
  /** Names of the fields an update changed, sorted; empty for any other action. */
  changedFields: string[];
}

/** What a service says about a change it just made. The actor is resolved from `actorId` by the audit module. */
export interface AuditRecordInput {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  changedFields?: readonly string[];
}
