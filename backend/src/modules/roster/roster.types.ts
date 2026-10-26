export interface RosterStudent {
  memberId: string;
  memberNumber: string;
  fullName: string;
  // Club-calendar dates (YYYY-MM-DD).
  startDate: string;
  endDate?: string;
  status: 'active' | 'ended';
}

// What a teacher may see of a discipline: the people who practice or practiced it, and nothing else.
export interface DisciplineRoster {
  discipline: { id: string; name: string };
  students: RosterStudent[];
}
