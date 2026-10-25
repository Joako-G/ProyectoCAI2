/** What the server lets a signed-in user do; mirrors the back-end capability policy. */
export type Capability =
  | 'members:read'
  | 'members:write'
  | 'memberships:read'
  | 'disciplines:read'
  | 'disciplines:write'
  | 'users:manage'
  | 'payments:collect'
  | 'payments:annul'
  | 'cashcount:run'
  | 'reports:read'
  | 'config:read'
  | 'config:manage';

/** The signed-in account as returned by `POST /auth/login`, with the capabilities of its role. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  capabilities: Capability[];
}

export type LoginStatus = 'idle' | 'pending' | 'error';
