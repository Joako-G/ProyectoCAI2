export type MembershipStatus = 'active' | 'ended';

// A membership is one dated period of a member in a discipline. It is history derived from
// Member.disciplineIds (the editable source) and is never deleted: ending it is logical.
export interface Membership {
  id: string;
  memberId: string;
  disciplineId: string;
  // Club-calendar dates (YYYY-MM-DD).
  startDate: string;
  status: MembershipStatus;
  endDate?: string;
  endReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipListQuery {
  memberId?: string;
  disciplineId?: string;
  status?: MembershipStatus;
}

// The slice of a member the reconcile needs.
export interface MemberDisciplines {
  id: string;
  disciplineIds: readonly string[];
  memberSince: string;
  // When the disciplines last changed; used to date repairs of members that already have history.
  disciplinesChangedOn?: string;
}
