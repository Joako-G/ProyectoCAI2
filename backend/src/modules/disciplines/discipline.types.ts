export type DisciplineStatus = 'active' | 'inactive';

export interface DisciplineInput {
  name: string;
  // Names, at least one, exactly one of them in charge. With `leadTeacherId` they are the names the teacher
  // accounts had when the discipline was saved; without it they were typed in before teachers were accounts.
  teachers: string[];
  leadTeacher: string;
  // The teacher account in charge. The other teachers are the accounts that have this discipline assigned.
  leadTeacherId?: string;
}

export interface Discipline extends DisciplineInput {
  id: string;
  status: DisciplineStatus;
  createdAt?: string;
  // Club-calendar date (YYYY-MM-DD) of the deactivation, like member deactivation dates.
  deactivatedAt?: string;
}

export interface DisciplineListQuery {
  search?: string;
  status?: DisciplineStatus;
}
