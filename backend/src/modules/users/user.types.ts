export interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
}

export type SafeUser = Omit<DemoUser, 'passwordHash'>;

export type UserFailure = 'invalid' | 'duplicate-email' | 'not-found' | 'save-failed';

export type UserResult = { ok: true; user: SafeUser } | { ok: false; failure: UserFailure };
