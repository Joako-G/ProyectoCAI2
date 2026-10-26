// Mirrors the backend response of GET /api/roster (backend/src/modules/roster/roster.types.ts).
export interface RosterStudent {
  memberId: string;
  memberNumber: string;
  fullName: string;
  /** Club-calendar dates (`YYYY-MM-DD`). */
  startDate: string;
  endDate?: string;
  status: 'active' | 'ended';
}

export interface DisciplineRoster {
  discipline: { id: string; name: string };
  students: RosterStudent[];
}
