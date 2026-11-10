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
  | 'expense'
  | 'backup'
  | 'face_profile';

/** Audit writes that failed since the server last started; it resets on restart. */
export interface AuditFailedWrites {
  count: number;
  /** ISO instant, or null while nothing has failed. */
  lastFailedAt: string | null;
}

/** A user who appears in the log, as they were at their latest entry; feeds the user filter. */
export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

/** What `GET /api/audit` answers: the (filtered) entries newest first, the failed-write tally and every actor of the log. */
export interface AuditLog {
  entries: AuditEntry[];
  failedWrites: AuditFailedWrites;
  /** Whole-log actors, so the user filter keeps its options while a filter is active. */
  actors: AuditActor[];
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

/** The filters of the screen. An empty string means "no filter"; `from` and `to` are club-local `YYYY-MM-DD` dates. */
export interface AuditFilters {
  actorId: string;
  /** Digits only, as typed: `7` and `0007` find the same member. */
  member: string;
  entityType: AuditEntityType | '';
  action: AuditAction | '';
  from: string;
  to: string;
}
