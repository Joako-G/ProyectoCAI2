// Mirrors the backend response shape (backend/src/modules/disciplines/discipline.types.ts).
export type DisciplineStatus = 'active' | 'inactive';
export type DisciplineStatusFilter = DisciplineStatus | 'all';

/** A teacher account that can be put on a discipline. */
export interface TeacherOption {
  id: string;
  name: string;
}

/** Data sent on create and update (the backend replaces every field on update). */
export interface DisciplineInput {
  name: string;
  /** At least one: the ids of active users with the teacher role. */
  teacherIds: string[];
  /** The teacher in charge; always one of `teacherIds`. */
  leadTeacherId: string;
}

export interface Discipline {
  id: string;
  name: string;
  /** The teachers' names, to show. Empty when no account has the discipline assigned. */
  teachers: string[];
  /** The name of the teacher in charge; empty when there is none. */
  leadTeacher: string;
  /** The accounts behind `teachers`; empty for names typed in before teachers were accounts. */
  teacherIds: string[];
  leadTeacherId: string | null;
  status: DisciplineStatus;
  createdAt?: string;
  /** Club-calendar date (`YYYY-MM-DD`) of the deactivation. */
  deactivatedAt?: string;
}

export interface DisciplineListQuery {
  search: string;
  status: DisciplineStatusFilter;
}
