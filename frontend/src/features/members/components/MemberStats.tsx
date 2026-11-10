import { lastSummary, type MembersSummaryState } from '../hooks/useMembersSummary';
import type { MembersSummary, StandingGroup } from '../types/member-summary';

/** What a stat card filters by: a member status or an account standing group. */
export type StatCardKey = 'active' | 'inactive' | StandingGroup;

interface MemberStatsProps {
  state: MembersSummaryState;
  /** The card whose filter is applied, if any. */
  selected: StatCardKey | null;
  /** Called with the card clicked; the parent decides whether that applies or clears the filter. */
  onSelect: (key: StatCardKey) => void;
  onRetry: () => void;
}

const CARDS: ReadonlyArray<{ key: StatCardKey; label: string; count: (summary: MembersSummary) => number }> = [
  { key: 'active', label: 'Activos', count: (summary) => summary.active },
  { key: 'inactive', label: 'Inactivos', count: (summary) => summary.inactive },
  { key: 'upToDate', label: 'Al día', count: (summary) => summary.upToDate },
  { key: 'debtors', label: 'Deudores', count: (summary) => summary.debtors },
  { key: 'overdue', label: 'Vencidos', count: (summary) => summary.overdue },
];

/**
 * Presentational: five counters that double as list filters. A failed summary never hides the list below; when a
 * refresh fails after the counts loaded once, the last counts stay on screen (and keep filtering) with a retry line.
 */
export function MemberStats({ state, selected, onSelect, onRetry }: MemberStatsProps) {
  const summary = lastSummary(state);
  const retryLine =
    state.phase === 'error' ? (
      <p className="member-stats__error" role="status">
        {summary ? 'No se pudieron actualizar los contadores; se muestran los últimos cargados.' : 'No se pudieron cargar los contadores.'}{' '}
        <button type="button" className="member-stats__retry" onClick={onRetry}>
          Reintentar
        </button>
      </p>
    ) : null;

  if (!summary && retryLine) return retryLine;

  return (
    <>
      <div className="member-stats" role="group" aria-label="Resumen de socios" aria-busy={summary === undefined}>
        {CARDS.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            className={`member-stat member-stat--${key}`}
            aria-pressed={selected === key}
            disabled={summary === undefined}
            onClick={() => onSelect(key)}
          >
            <span className="member-stat__value">{summary ? count(summary) : '–'}</span>
            <span className="member-stat__label">{label}</span>
          </button>
        ))}
      </div>
      {retryLine}
    </>
  );
}
