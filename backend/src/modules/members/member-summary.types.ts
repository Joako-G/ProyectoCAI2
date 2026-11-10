/** Counts and ids behind the stat cards on the members screen. Carries no names, DNI or amounts. */
export interface MemberSummary {
  active: number;
  inactive: number;
  /** Active members with nothing owed. */
  upToDate: number;
  /** Active members owing one to three months. */
  debtors: number;
  /** Active members owing more than three months (deregistered for debt). */
  overdue: number;
  /** Ids of the three standing groups, so the client can filter its loaded list. */
  ids: {
    upToDate: string[];
    debtors: string[];
    overdue: string[];
  };
}
