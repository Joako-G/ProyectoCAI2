export const roles = ['secretary', 'head_secretary', 'teacher'] as const;
export type Role = (typeof roles)[number];

/** Roles from before the role-based authorization, mapped to their replacement when users are read. */
export const legacyRoles: Readonly<Record<string, Role>> = { admin: 'head_secretary', member: 'secretary' };

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
}

export type SafeUser = Omit<DemoUser, 'passwordHash'>;

export type UserFailure = 'invalid' | 'duplicate-email' | 'not-found' | 'save-failed';

export type UserResult = { ok: true; user: SafeUser } | { ok: false; failure: UserFailure };
