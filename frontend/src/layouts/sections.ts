import type { AuthUser, Capability } from '../features/auth/types/auth';
import { can } from '../features/auth/utils/can';

export type Section = 'members' | 'disciplines' | 'payments' | 'users' | 'roster' | 'pricing';

/** Navigation order; each section needs one capability to be reachable. */
export const SECTIONS: ReadonlyArray<{ id: Section; label: string; capability: Capability }> = [
  { id: 'members', label: 'Socios', capability: 'members:read' },
  { id: 'disciplines', label: 'Disciplinas', capability: 'disciplines:read' },
  { id: 'payments', label: 'Cobros', capability: 'payments:read' },
  { id: 'users', label: 'Usuarios', capability: 'users:manage' },
  { id: 'roster', label: 'Mis disciplinas', capability: 'roster:read' },
  { id: 'pricing', label: 'Precios', capability: 'config:read' },
];

/** The sections a user may open, in navigation order. */
export function sectionsFor(user: Pick<AuthUser, 'capabilities'>): Section[] {
  return SECTIONS.filter(({ capability }) => can(user, capability)).map(({ id }) => id);
}
