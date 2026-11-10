import type { MembersSummary, StandingGroup } from '../types/member-summary';

/** What the list and the record call each account standing group; the same words as the filter buttons. */
export const STANDING_CHIP_LABEL: Record<StandingGroup, string> = {
  upToDate: 'Al día',
  debtors: 'Debe',
  overdue: 'Vencido',
};

/** Member id -> standing group, from the ids the summary already carries (no extra request). */
export function standingByMemberId(summary: MembersSummary | undefined): ReadonlyMap<string, StandingGroup> {
  const byId = new Map<string, StandingGroup>();
  if (!summary) return byId;
  for (const group of ['upToDate', 'debtors', 'overdue'] as const) {
    // Optional chaining: a partial answer must never break the list, which is usable without the standing.
    for (const id of summary.ids?.[group] ?? []) byId.set(id, group);
  }
  return byId;
}
