import type { AuthUser, Capability } from '../features/auth/types/auth';
import { can } from '../features/auth/utils/can';

export type Section = 'members' | 'disciplines' | 'payments' | 'cashcount' | 'reports' | 'users' | 'roster' | 'pricing';

/**
 * Navigation order; each section lives at its own URL and needs one capability to be reachable.
 * Paths are Spanish on purpose: the dev server proxies `/users` and `/auth` to the API.
 */
export const SECTIONS: ReadonlyArray<{ id: Section; label: string; subtitle: string; path: string; capability: Capability }> = [
  { id: 'members', label: 'Socios', subtitle: 'Búsqueda por N° de socio, DNI o nombre', path: '/socios', capability: 'members:read' },
  { id: 'disciplines', label: 'Disciplinas', subtitle: 'Catálogo de disciplinas y sus profesores', path: '/disciplinas', capability: 'disciplines:read' },
  { id: 'payments', label: 'Cobros', subtitle: 'Cobro de cuotas por DNI, comprobantes y anulaciones', path: '/cobros', capability: 'payments:read' },
  { id: 'cashcount', label: 'Arqueo', subtitle: 'Cierre diario de caja: efectivo contado y diferencia', path: '/caja/arqueo', capability: 'cashcount:run' },
  { id: 'reports', label: 'Reportes', subtitle: 'Recaudación por período y liquidación por disciplina', path: '/reportes', capability: 'reports:read' },
  { id: 'users', label: 'Usuarios', subtitle: 'Administración de cuentas de demostración', path: '/usuarios', capability: 'users:manage' },
  { id: 'roster', label: 'Mis disciplinas', subtitle: 'Alumnos actuales y anteriores de sus disciplinas', path: '/mis-disciplinas', capability: 'roster:read' },
  { id: 'pricing', label: 'Precios', subtitle: 'Tarifas, recargos por pago tardío y prorrateo', path: '/precios', capability: 'config:read' },
];

/**
 * How the sidebar lists sections: a bare id is a link, a group is a labelled set of links shown only
 * when the user may open `requires`. A section is listed once, at its first place in the layout, so a
 * link placed after a group is the fallback for users who do not get that group.
 */
export type NavLayoutEntry = Section | { id: string; label: string; requires: Section; items: ReadonlyArray<Section> };

export type NavEntry =
  | { kind: 'link'; section: Section }
  | { kind: 'group'; id: string; label: string; items: Section[] };

/**
 * The sidebar: plain links in section order, except Caja. Whoever may run the cash count gets the Caja group
 * with Arqueo and Reportes; everyone else who may read reports gets the Reportes link that follows it.
 */
export const NAVIGATION: ReadonlyArray<NavLayoutEntry> = SECTIONS.flatMap(({ id }): NavLayoutEntry[] => {
  if (id === 'cashcount') return [{ id: 'caja', label: 'Caja', requires: 'cashcount', items: ['cashcount', 'reports'] }];
  return [id];
});

/** The sidebar entries for the allowed sections: groups and links in layout order, each section once. */
export function navigationFor(allowed: ReadonlyArray<Section>, layout: ReadonlyArray<NavLayoutEntry> = NAVIGATION): NavEntry[] {
  const placed = new Set<Section>();
  const entries: NavEntry[] = [];
  for (const entry of layout) {
    if (typeof entry === 'string') {
      if (allowed.includes(entry) && !placed.has(entry)) {
        placed.add(entry);
        entries.push({ kind: 'link', section: entry });
      }
      continue;
    }
    if (!allowed.includes(entry.requires)) continue;
    const items = entry.items.filter((item) => allowed.includes(item) && !placed.has(item));
    if (items.length === 0) continue;
    items.forEach((item) => placed.add(item));
    entries.push({ kind: 'group', id: entry.id, label: entry.label, items });
  }
  return entries;
}

/** The sections a user may open, in navigation order. */
export function sectionsFor(user: Pick<AuthUser, 'capabilities'>): Section[] {
  return SECTIONS.filter(({ capability }) => can(user, capability)).map(({ id }) => id);
}
