export type UserRole = 'member' | 'admin';

/** A user account as returned by `GET /users` (never includes the password hash). */
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export interface UserFormValues {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  active: boolean;
}

export interface UserPayload {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  active?: boolean;
}
