import type { ManagedUser, UserPayload } from '../types/user';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function userUrl(id: string): string {
  return `/users/${encodeURIComponent(id)}`;
}

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(`Users request failed with status ${response.status}`);
  return response;
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const response = await ensureOk(await fetch('/users'));
  return await response.json() as ManagedUser[];
}

/** Creates a user, or updates it when `id` is given. */
export async function saveUser(payload: UserPayload, id?: string): Promise<void> {
  await ensureOk(await fetch(id ? userUrl(id) : '/users', {
    method: id ? 'PATCH' : 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  }));
}

/** Reactivates through a partial update; deactivation uses the logical DELETE endpoint. */
export async function setUserActive(id: string, active: boolean): Promise<void> {
  await ensureOk(await fetch(userUrl(id), active
    ? { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ active }) }
    : { method: 'DELETE' }));
}
