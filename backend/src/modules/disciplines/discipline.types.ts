export type DisciplineStatus = 'active' | 'inactive';

export interface DisciplineInput {
  name: string;
  teacherName: string;
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
