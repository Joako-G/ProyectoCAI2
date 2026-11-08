export type AccessResult = 'green' | 'yellow' | 'red';
export type AccessReason = 'up_to_date' | 'debtor' | 'deregistered' | 'inactive' | 'not_found' | 'not_recognized';

/** What the door needs to know about a member: who it is and how many months are unpaid and since when, never amounts or the DNI. */
export interface AccessMemberSummary {
  memberNumber: string;
  name: string;
  unpaidPeriodCount: number;
  /** Up to date members only: the last month, as YYYY-MM, with nothing owed from the start through it. */
  paidThrough?: string;
  /** Up to date members with a paidThrough month only: the last day, as YYYY-MM-DD, to pay the next month without surcharge. */
  dueDate?: string;
  /** Debtor and deregistered members only: the oldest unpaid month, as YYYY-MM. */
  debtSince?: string;
}

export interface AccessCheck {
  result: AccessResult;
  reason: AccessReason;
  /** Absent when the DNI is not registered or the face was not recognized. */
  member?: AccessMemberSummary;
}
