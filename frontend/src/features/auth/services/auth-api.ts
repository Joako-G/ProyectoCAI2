import type { AuthUser } from '../types/auth';

// The session lives in an httpOnly cookie, so every auth request must send credentials.
export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed with status ${response.status}`);
  const result = await response.json() as { user: AuthUser };
  return result.user;
}

/** Returns the user of the current server session, or null when there is none. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/auth/me', { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session check failed with status ${response.status}`);
  const result = await response.json() as { user?: AuthUser };
  return result.user ?? null;
}

export async function logout(): Promise<void> {
  const response = await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error(`Logout failed with status ${response.status}`);
}
