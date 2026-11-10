// Mirrors the backend response of GET /api/members/summary (backend/src/modules/members/member-summary.types.ts).
export interface MembersSummary {
  active: number;
  inactive: number;
  upToDate: number;
  debtors: number;
  overdue: number;
  /** Member ids of the three standing groups, to filter the loaded list. */
  ids: {
    upToDate: string[];
    debtors: string[];
    overdue: string[];
  };
}

/** The account standing groups a stat card can filter the list by. */
export type StandingGroup = 'upToDate' | 'debtors' | 'overdue';
