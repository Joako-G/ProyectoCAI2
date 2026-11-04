export type AuditAction = 'create' | 'update' | 'deactivate' | 'reactivate' | 'delete' | 'annul' | 'close';

export type AuditEntityType =
  | 'member'
  | 'discipline'
  | 'user'
  | 'tariff'
  | 'surcharge_tiers'
  | 'proration_rule'
  | 'payment'
  | 'cash_count'
  | 'backup';

/** Audit writes that failed since the server last started; it resets on restart. */
export interface AuditFailedWrites {
  count: number;
  /** ISO instant, or null while nothing has failed. */
  lastFailedAt: string | null;
}

/** What `GET /api/audit` answers: the entries newest first and the failed-write tally. */
export interface AuditLog {
  entries: AuditEntry[];
  failedWrites: AuditFailedWrites;
}

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
  /** A readable name for the record, resolved by the server when the log is read; never stored. */
  entityLabel: string;
  /** Names of the fields an update changed; never their values. */
  changedFields: string[];
}
