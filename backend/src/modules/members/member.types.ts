export const MEMBER_CATEGORIES = ['Infantil', 'Cadete', 'Mayor', 'Vitalicia'] as const;

export type MemberCategory = (typeof MEMBER_CATEGORIES)[number];
export type MemberStatus = 'active' | 'inactive';

export interface Guardian {
  name: string;
  contact: string;
}

export interface Deactivation {
  date: string;
  reason: string;
}

export interface MemberInput {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  category: MemberCategory;
  memberSince: string;
  whatsapp: string;
  disciplineIds: string[];
  email?: string;
  guardian?: Guardian;
}

export interface Member extends MemberInput {
  id: string;
  memberNumber: string;
  status: MemberStatus;
  deactivation?: Deactivation;
  // Club-calendar date (YYYY-MM-DD) the set of disciplines last changed; system-set, not editable input.
  // Absent on legacy records.
  disciplinesChangedOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberListQuery {
  search?: string;
  status?: MemberStatus;
  disciplineId?: string;
}
