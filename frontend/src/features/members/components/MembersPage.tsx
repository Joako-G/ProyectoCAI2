import { DisciplineCatalogNotice } from '../../disciplines/components/DisciplineCatalogNotice';
import { catalogDisciplines, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { useMembersList } from '../hooks/useMembersList';
import type { MemberListQuery } from '../types/member';
import { todayInClub } from '../utils/member-format';
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
}

const STATUS_FILTER_LABEL = { all: 'Todos', active: 'Activos', inactive: 'Inactivos' } as const;

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
}: MembersPageProps) {
  const { search, status, disciplineId = '' } = query;
  const { state, retry } = useMembersList(query);
  const disciplines = catalog ? catalogDisciplines(catalog) : [];

  // Submitting the same text again acts as a refresh: the unchanged query alone would not refetch.
  function submitSearch(next: string) {
    onQueryChange({ ...query, search: next });
    retry();
  }

  return (
    <section className="card members-page" aria-label="Socios">
      <MembersToolbar
        search={search}
        status={status}
        disciplineId={disciplineId}
        disciplines={disciplines}
        catalogPhase={catalog?.state.phase}
        onSearchSubmit={submitSearch}
        onStatusChange={(next) => onQueryChange({ ...query, status: next })}
        onDisciplineChange={(next) => onQueryChange({ ...query, disciplineId: next })}
        canCreate={canCreate}
        onCreate={onCreate}
      />

      <div className="members-page__summary">
        Filtro: <strong>{STATUS_FILTER_LABEL[status]}</strong>
        {state.phase === 'ready' ? (
          <>
            {' · '}
            <span>{resultsLabel(state.members.length)}</span>
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

      {state.phase === 'ready' && state.members.length === 0 ? (
        <p className="members-page__notice">
          No hay socios que coincidan con la búsqueda o el filtro.
        </p>
      ) : null}

      {state.phase === 'ready' && state.members.length > 0 ? (
        <MembersTable
          members={state.members}
          today={today}
          disciplines={disciplines}
          onOpen={onOpen ? (member) => onOpen(member.id) : undefined}
        />
      ) : null}
    </section>
  );
}
