// Mirrors the backend response shape (backend/src/modules/disciplines/discipline.types.ts).
export type DisciplineStatus = 'active' | 'inactive';
export type DisciplineStatusFilter = DisciplineStatus | 'all';

/** Data sent on create and update (the backend replaces both fields on update). */
export interface DisciplineInput {
  name: string;
  teacherName: string;
}

export interface Discipline extends DisciplineInput {
  id: string;
  status: DisciplineStatus;
  createdAt?: string;
  /** Club-calendar date (`YYYY-MM-DD`) of the deactivation. */
  deactivatedAt?: string;
}

export interface DisciplineListQuery {
  search: string;
  status: DisciplineStatusFilter;
}
