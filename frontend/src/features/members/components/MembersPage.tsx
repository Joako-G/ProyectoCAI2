import { useMembersList } from '../hooks/useMembersList';
import { todayInClub } from '../utils/member-format';
import { MembersTable } from './MembersTable';
import { MembersToolbar } from './MembersToolbar';

interface MembersPageProps {
  /** Overrides today's club date (`YYYY-MM-DD`); used by tests. */
  today?: string;
  onCreate?: () => void;
}

const STATUS_FILTER_LABEL = { all: 'Todos', active: 'Activos', inactive: 'Inactivos' } as const;

function resultsLabel(count: number): string {
  return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
}

/** Container: fetches the members and composes the presentational toolbar and table. */
export function MembersPage({ today = todayInClub(), onCreate }: MembersPageProps) {
  const { search, status, state, setSearch, setStatus, retry } = useMembersList();

  return (
    <section className="card members-page" aria-label="Socios">
      <MembersToolbar
        search={search}
        status={status}
        onSearchSubmit={setSearch}
        onStatusChange={setStatus}
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
        <MembersTable members={state.members} today={today} />
      ) : null}
    </section>
  );
}
