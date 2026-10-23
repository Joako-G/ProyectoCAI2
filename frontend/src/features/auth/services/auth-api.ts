import type { AuthUser } from '../types/auth';

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed with status ${response.status}`);
  const result = await response.json() as { user: AuthUser };
  return result.user;
}
