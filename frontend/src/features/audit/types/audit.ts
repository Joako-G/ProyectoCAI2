export type AuditAction = 'create' | 'update' | 'deactivate' | 'reactivate' | 'delete' | 'annul' | 'close';

export type AuditEntityType =
  | 'member'
  | 'discipline'
  | 'user'
  | 'tariff'
  | 'surcharge_tiers'
  | 'proration_rule'
  | 'payment'
  | 'cash_count';

/** Mirrors `AuditEntry` in backend/src/modules/audit/audit.types.ts. */
export interface AuditEntry {
  id: string;
  /** ISO instant. */
  at: string;
  /** Who did it, as they were at that moment. */
  actor: { id: string; name: string; role: string };
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** Names of the fields an update changed; never their values. */
  changedFields: string[];
}
