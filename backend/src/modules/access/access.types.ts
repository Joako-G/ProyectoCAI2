export type AccessResult = 'green' | 'yellow' | 'red';
export type AccessReason = 'up_to_date' | 'debtor' | 'deregistered' | 'inactive' | 'not_found';

/** What the door needs to know about a member: who it is and how many months are unpaid, never amounts or the DNI. */
export interface AccessMemberSummary {
  memberNumber: string;
  name: string;
  unpaidPeriodCount: number;
}

export interface AccessCheck {
  result: AccessResult;
  reason: AccessReason;
  /** Absent when the DNI is not registered. */
  member?: AccessMemberSummary;
}
