/** The signed-in account as returned by `POST /auth/login`. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type LoginStatus = 'idle' | 'pending' | 'error';
