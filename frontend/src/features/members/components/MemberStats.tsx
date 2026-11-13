import { lastSummary, type MembersSummaryState } from '../hooks/useMembersSummary';
import type { MembersSummary, StandingGroup } from '../types/member-summary';

/** What a filter button of the register bar applies: a member status or an account standing group. */
export type StatCardKey = 'active' | 'inactive' | StandingGroup;

interface MemberStatsProps {
  state: MembersSummaryState;
  /** The filter applied, if any. */
  selected: StatCardKey | null;
  /** Called with the button or bar segment clicked; the parent decides whether that applies or clears the filter. */
  onSelect: (key: StatCardKey) => void;
  onRetry: () => void;
}

type Entry = { key: StatCardKey; label: string; count: (summary: MembersSummary) => number };

const ACTIVE: Entry = { key: 'active', label: 'Activos', count: (summary) => summary.active };
const INACTIVE: Entry = { key: 'inactive', label: 'Inactivos', count: (summary) => summary.inactive };
const STANDINGS: ReadonlyArray<Entry & { key: StandingGroup }> = [
  { key: 'upToDate', label: 'Al día', count: (summary) => summary.upToDate },
  { key: 'debtors', label: 'Deudores', count: (summary) => summary.debtors },
  { key: 'overdue', label: 'Vencidos', count: (summary) => summary.overdue },
];

/**
 * Presentational: the register bar. One panel whose proportional bar splits the active members into al día, deudores
 * and vencidos; the five filter buttons are its legend and the bar segments mirror the standing ones. A failed
 * summary never hides the list below; when a refresh fails after the counts loaded once, the last counts stay on
 * screen (and keep filtering) with a retry line.
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

  const standingSelected = STANDINGS.some(({ key }) => key === selected);

  function filterButton({ key, label, count }: Entry) {
    return (
      <button
        key={key}
        type="button"
        className={`padron__filter padron__filter--${key}`}
        aria-pressed={selected === key}
        disabled={summary === undefined}
        onClick={() => onSelect(key)}
      >
        <span className="padron__value">{summary ? count(summary) : '–'}</span>
        <span className="padron__label">{label}</span>
      </button>
    );
  }

  return (
    <>
      <div className="card padron" role="group" aria-label="Resumen de socios" aria-busy={summary === undefined}>
        <div className="padron__totals">
          {filterButton(ACTIVE)}
          {filterButton(INACTIVE)}
        </div>

        {/* Decorative mirror of the three standing buttons below, which stay the accessible controls. */}
        <div className="padron__bar" aria-hidden="true">
          {STANDINGS.map(({ key, count }) => {
            const value = summary ? count(summary) : 0;
            // A group with nobody is left out of the bar, unless it is the one selected: then it keeps a sliver.
            if (value === 0 && selected !== key) return null;
            return (
              <span
                key={key}
                className={`padron__segment padron__segment--${key}`}
                data-dimmed={standingSelected && selected !== key ? 'true' : undefined}
                style={{ flexGrow: value }}
                onClick={() => onSelect(key)}
              />
            );
          })}
        </div>

        <div className="padron__legend">{STANDINGS.map(filterButton)}</div>
      </div>
      {retryLine}
    </>
  );
}
