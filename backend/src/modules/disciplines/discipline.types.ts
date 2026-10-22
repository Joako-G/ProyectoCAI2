export type DisciplineStatus = 'active' | 'inactive';

export interface DisciplineInput {
  name: string;
  // At least one teacher; exactly one of them is in charge (teachers are not system users).
  teachers: string[];
  leadTeacher: string;
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
