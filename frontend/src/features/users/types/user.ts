export type UserRole = 'secretary' | 'head_secretary' | 'teacher';

/** A user account as returned by `GET /users` (never includes the password hash). */
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  /** Teachers only: the disciplines they teach. */
  disciplineIds?: string[];
}

export interface UserFormValues {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  active: boolean;
  /** Only sent for teachers. */
  disciplineIds: string[];
}

export interface UserPayload {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  active?: boolean;
  disciplineIds?: string[];
}
