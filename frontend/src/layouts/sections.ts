import type { AuthUser, Capability } from '../features/auth/types/auth';
import { can } from '../features/auth/utils/can';

export type Section = 'members' | 'disciplines' | 'payments' | 'users' | 'roster' | 'pricing';

/**
 * Navigation order; each section lives at its own URL and needs one capability to be reachable.
 * Paths are Spanish on purpose: the dev server proxies `/users` and `/auth` to the API.
 */
export const SECTIONS: ReadonlyArray<{ id: Section; label: string; subtitle: string; path: string; capability: Capability }> = [
  { id: 'members', label: 'Socios', subtitle: 'Búsqueda por N° de socio, DNI o nombre', path: '/socios', capability: 'members:read' },
  { id: 'disciplines', label: 'Disciplinas', subtitle: 'Catálogo de disciplinas y sus profesores', path: '/disciplinas', capability: 'disciplines:read' },
  { id: 'payments', label: 'Cobros', subtitle: 'Cobro de cuotas por DNI, comprobantes y anulaciones', path: '/cobros', capability: 'payments:read' },
  { id: 'users', label: 'Usuarios', subtitle: 'Administración de cuentas de demostración', path: '/usuarios', capability: 'users:manage' },
  { id: 'roster', label: 'Mis disciplinas', subtitle: 'Alumnos actuales y anteriores de sus disciplinas', path: '/mis-disciplinas', capability: 'roster:read' },
  { id: 'pricing', label: 'Precios', subtitle: 'Tarifas, recargos por pago tardío y prorrateo', path: '/precios', capability: 'config:read' },
];

/** The sections a user may open, in navigation order. */
export function sectionsFor(user: Pick<AuthUser, 'capabilities'>): Section[] {
  return SECTIONS.filter(({ capability }) => can(user, capability)).map(({ id }) => id);
}
