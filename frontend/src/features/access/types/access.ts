/** Mirrors `AccessCheck` in backend/src/modules/access/access.types.ts. */
export type AccessResult = 'green' | 'yellow' | 'red';
export type AccessReason = 'up_to_date' | 'debtor' | 'deregistered' | 'inactive' | 'not_found';

export interface AccessCheck {
  result: AccessResult;
  reason: AccessReason;
  /** Absent when the DNI is not registered. */
  member?: {
    memberNumber: string;
    name: string;
    unpaidPeriodCount: number;
    /** YYYY-MM; up to date members only. */
    paidThrough?: string;
    /** YYYY-MM; debtor and deregistered members only. */
    debtSince?: string;
  };
}
