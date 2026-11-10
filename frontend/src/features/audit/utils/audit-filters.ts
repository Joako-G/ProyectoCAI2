import type { AuditActor, AuditEntry, AuditFilters } from '../types/audit';
import { actionLabel, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, clubDay, entityTypeLabel, formatDay } from './audit-format';

export const EMPTY_FILTERS: AuditFilters = { actorId: '', member: '', entityType: '', action: '', from: '', to: '' };

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof AuditFilters>;
const MEMBER_NUMBER = /^\d{1,10}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/**
 * Reads the filters from a query string. A shared or hand-edited link may carry a value the server would refuse, so
 * anything unknown is dropped here instead of turning the screen into an error.
 */
export function filtersFromParams(params: URLSearchParams): AuditFilters {
  const entityType = params.get('entityType') ?? '';
  const action = params.get('action') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const member = params.get('member') ?? '';
  const actorId = params.get('actorId') ?? '';
  const filters: AuditFilters = {
    actorId: actorId.length > 0 && actorId.length <= 100 ? actorId : '',
    member: MEMBER_NUMBER.test(member) ? member : '',
    entityType: (AUDIT_ENTITY_TYPES as string[]).includes(entityType) ? (entityType as AuditFilters['entityType']) : '',
    action: (AUDIT_ACTIONS as readonly string[]).includes(action) ? (action as AuditFilters['action']) : '',
    from: isRealDay(from) ? from : '',
    to: isRealDay(to) ? to : '',
  };
  // A range that ends before it starts is refused by the server; keep the start and drop the end.
  if (filters.from && filters.to && filters.from > filters.to) filters.to = '';
  return filters;
}

/** The query string of the filters, only the ones in use and in a fixed order, so equal filters give equal text. */
export function filtersToParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
  return params;
}

/** Applies a change to the filters, keeping the range coherent: moving one end past the other moves the other too. */
export function applyFilterChange(current: AuditFilters, change: Partial<AuditFilters>): AuditFilters {
  const next = { ...current, ...change };
  if (next.from && next.to && next.from > next.to) {
    if ('from' in change && !('to' in change)) next.to = next.from;
    else next.from = next.to;
  }
  return next;
}

export const hasActiveFilters = (filters: AuditFilters) => FILTER_KEYS.some((key) => filters[key] !== '');

export type QuickRange = 'today' | 'last7' | 'last30';

export const QUICK_RANGES: ReadonlyArray<{ id: QuickRange; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'last7', label: 'Últimos 7 días' },
  { id: 'last30', label: 'Últimos 30 días' },
];

const DAYS_BACK: Record<QuickRange, number> = { today: 0, last7: 6, last30: 29 };

/** The inclusive club-local range of a quick option, counting today as the last day. */
export function quickRange(range: QuickRange, now: Date = new Date()): { from: string; to: string } {
  const to = clubDay(now);
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - DAYS_BACK[range]);
  return { from: start.toISOString().slice(0, 10), to };
}

/** The quick option whose range is exactly the one chosen, if any. */
export function activeQuickRange(filters: AuditFilters, now: Date = new Date()): QuickRange | undefined {
  return QUICK_RANGES.find(({ id }) => {
    const range = quickRange(id, now);
    return filters.from === range.from && filters.to === range.to;
  })?.id;
}

export interface FilterChip {
  key: keyof AuditFilters;
  label: string;
}

/** One removable chip per filter in use, in the order of the filter card. */
export function filterChips(filters: AuditFilters, actors: readonly AuditActor[]): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.actorId) {
    const actor = actors.find((candidate) => candidate.id === filters.actorId);
    chips.push({ key: 'actorId', label: `Usuario: ${actor?.name ?? 'seleccionado'}` });
  }
  if (filters.member) chips.push({ key: 'member', label: `Socio: ${filters.member}` });
  if (filters.entityType) chips.push({ key: 'entityType', label: `Registro: ${entityTypeLabel(filters.entityType)}` });
  if (filters.action) chips.push({ key: 'action', label: `Acción: ${actionLabel(filters.action)}` });
  if (filters.from) chips.push({ key: 'from', label: `Desde: ${formatDay(filters.from)}` });
  if (filters.to) chips.push({ key: 'to', label: `Hasta: ${formatDay(filters.to)}` });
  return chips;
}

/**
 * The member number of a record that is a member (or the face profile of one), taken from the server's label, for
 * example `Socio 0007`. A record the server could not resolve has no number and gives undefined.
 */
export function memberNumberOf(entry: Pick<AuditEntry, 'entityType' | 'entityLabel'>): string | undefined {
  if (entry.entityType !== 'member' && entry.entityType !== 'face_profile') return undefined;
  return /\b(\d{1,10})$/.exec(entry.entityLabel)?.[1];
}

/** `2 registros`, `1 registro`, `Sin registros`. */
export function resultsSummary(count: number): string {
  if (count === 0) return 'Sin registros';
  return `${count} ${count === 1 ? 'registro' : 'registros'}`;
}
