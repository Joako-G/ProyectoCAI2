import { useMemo } from 'react';
import { Pagination } from '../../../components/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import { DisciplineCatalogNotice } from '../../disciplines/components/DisciplineCatalogNotice';
import { catalogDisciplines, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { useMembersList } from '../hooks/useMembersList';
import { lastSummary, type MembersSummaryController } from '../hooks/useMembersSummary';
import type { Member, MemberListQuery } from '../types/member';
import type { StandingGroup } from '../types/member-summary';
import { todayInClub } from '../utils/member-format';
import { standingByMemberId } from '../utils/member-standing';
import { MemberStats, type StatCardKey } from './MemberStats';
import { MembersTable } from './MembersTable';
import { MembersToolbar } from './MembersToolbar';

interface MembersPageProps {
  /** Overrides today's club date (`YYYY-MM-DD`); used by tests. */
  today?: string;
  /** Search, status and discipline filters; owned by the parent so they survive detail and form. */
  query: MemberListQuery;
  onQueryChange: (query: MemberListQuery) => void;
  /** Discipline catalog for the filter and the row names; without it the filter stays empty. */
  catalog?: DisciplineCatalog;
  /** Whether to offer the create action. */
  canCreate: boolean;
  onCreate?: () => void;
  /** Opens a member's detail. */
  onOpen?: (id: string) => void;
  /** The stat cards' counts; without it the cards are not shown. */
  summary?: MembersSummaryController;
  /** Account standing group the list is narrowed to; owned by the parent like the query. */
  standing?: StandingGroup | null;
  onStandingChange?: (standing: StandingGroup | null) => void;
}

const NO_MEMBERS: Member[] = [];

const STATUS_FILTER_LABEL = { all: 'Todos', active: 'Activos', inactive: 'Inactivos' } as const;
const STANDING_FILTER_LABEL: Record<StandingGroup, string> = { upToDate: 'Al día', debtors: 'Deudores', overdue: 'Vencidos' };

function resultsLabel(count: number): string {
  return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
}

/** Container: fetches the members and composes the presentational toolbar and table. */
export function MembersPage({
  today = todayInClub(),
  query,
  onQueryChange,
  catalog,
  canCreate,
  onCreate,
  onOpen,
  summary,
  standing = null,
  onStandingChange,
}: MembersPageProps) {
  const { search, status, disciplineId = '' } = query;
  const { state, retry } = useMembersList(query);
  // A new search or filter starts again from the first page.
  // The standing groups come from the summary; after a failed refresh the last loaded ids keep the filter applied.
  const loadedSummary = summary ? lastSummary(summary.state) : undefined;
  const standingIds = standing && loadedSummary ? loadedSummary.ids[standing] : null;
  const members = useMemo(() => {
    if (state.phase !== 'ready') return NO_MEMBERS;
    if (!standingIds) return state.members;
    const wanted = new Set(standingIds);
    return state.members.filter((member) => wanted.has(member.id));
  }, [state, standingIds]);
  const activeStanding = standingIds ? standing : null;
  const pager = usePagination(members, JSON.stringify({ query, standing: activeStanding }));
  const disciplines = catalog ? catalogDisciplines(catalog) : [];
  const standingById = useMemo(() => standingByMemberId(loadedSummary), [loadedSummary]);

  // Submitting the same text again acts as a refresh: the unchanged query alone would not refetch.
  function submitSearch(next: string) {
    onQueryChange({ ...query, search: next });
    retry();
  }

  const selectedCard: StatCardKey | null = activeStanding ?? (status === 'all' ? null : status);

  // Clicking the selected card clears its filter; any card replaces the previous one.
  function selectCard(key: StatCardKey) {
    const clearing = key === selectedCard;
    if (key === 'active' || key === 'inactive') {
      onQueryChange({ ...query, status: clearing ? 'all' : key });
      onStandingChange?.(null);
    } else {
      onQueryChange({ ...query, status: 'all' });
      onStandingChange?.(clearing ? null : key);
    }
  }

  return (
    <div className="members-screen">
      {canCreate ? (
        <div className="members-screen__head">
          <button type="button" className="button button--primary" onClick={onCreate}>
            Alta de socio
          </button>
        </div>
      ) : null}
      {summary ? <MemberStats state={summary.state} selected={selectedCard} onSelect={selectCard} onRetry={summary.refresh} /> : null}
      <section className="card members-page" aria-label="Socios">
        <MembersToolbar
          search={search}
          status={status}
          disciplineId={disciplineId}
          disciplines={disciplines}
          catalogPhase={catalog?.state.phase}
          onSearchSubmit={submitSearch}
          onStatusChange={(next) => {
            onQueryChange({ ...query, status: next });
            onStandingChange?.(null);
          }}
          onDisciplineChange={(next) => onQueryChange({ ...query, disciplineId: next })}
        />

        <div className="members-page__summary">
          Filtro: <strong>{activeStanding ? STANDING_FILTER_LABEL[activeStanding] : STATUS_FILTER_LABEL[status]}</strong>
          {state.phase === 'ready' ? (
            <>
              {' · '}
              <span>{resultsLabel(members.length)}</span>
            </>
          ) : null}
        </div>

        {catalog ? <DisciplineCatalogNotice catalog={catalog} /> : null}

        {state.phase === 'loading' ? (
          <p className="members-page__notice" role="status">
            Cargando socios…
          </p>
        ) : null}

        {state.phase === 'error' ? (
          <div className="members-page__notice members-page__notice--error" role="alert">
            <p>
              <strong>No se pudo cargar el listado.</strong> {state.message}
            </p>
            <button type="button" className="button button--secondary" onClick={retry}>
              Reintentar
            </button>
          </div>
        ) : null}

        {state.phase === 'ready' && members.length === 0 ? (
          <p className="members-page__notice">
            No hay socios que coincidan con la búsqueda o el filtro.
          </p>
        ) : null}

        {state.phase === 'ready' && members.length > 0 ? (
          <>
            <MembersTable
              members={pager.pageItems}
              today={today}
              disciplines={disciplines}
              standingById={standingById}
              onOpen={onOpen ? (member) => onOpen(member.id) : undefined}
            />
            <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} onPageChange={pager.setPage} label="Paginación de socios" />
          </>
        ) : null}
      </section>
    </div>
  );
}
