// Mirrors the backend response shape (backend/src/modules/members/member.types.ts).
export type MemberCategory = 'Infantil' | 'Cadete' | 'Mayor' | 'Vitalicia';
export type MemberStatus = 'active' | 'inactive';
export type MemberStatusFilter = MemberStatus | 'all';

export interface Guardian {
  name: string;
  contact: string;
}

export interface Deactivation {
  date: string;
  reason: string;
}

export const MEMBER_CATEGORIES: readonly MemberCategory[] = ['Infantil', 'Cadete', 'Mayor', 'Vitalicia'];

/** Personal data sent on create and update (the backend replaces all personal fields on update). */
export interface MemberInput {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  category: MemberCategory;
  memberSince: string;
  whatsapp: string;
  /** Ids of the assigned disciplines; at least one is required. Legacy members read as `[]`. */
  disciplineIds: string[];
  email?: string;
  guardian?: Guardian;
}

export interface Member extends MemberInput {
  id: string;
  memberNumber: string;
  status: MemberStatus;
  deactivation?: Deactivation;
  createdAt: string;
  updatedAt: string;
}

export interface MemberListQuery {
  search: string;
  status: MemberStatusFilter;
  /** Only members assigned to this discipline; empty or missing means every discipline. */
  disciplineId?: string;
}
