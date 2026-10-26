import { useRoster } from '../hooks/useRoster';
import { RosterBlock } from './RosterBlock';

/** Container of the roster feature: the signed-in teacher's disciplines and their students. */
export function RosterView() {
  const { state, reload } = useRoster();

  return (
    <section className="card members-page" aria-label="Mis disciplinas">
      {state.phase === 'loading' ? (
        <p className="members-page__notice" role="status">Cargando disciplinas…</p>
      ) : null}

      {state.phase === 'error' ? (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudo cargar el listado.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      ) : null}

      {state.phase === 'ready' && state.rosters.length === 0 ? (
        <p className="members-page__notice">Todavía no tiene disciplinas asignadas. Consulte con la jefa de secretaría.</p>
      ) : null}

      {state.phase === 'ready' ? state.rosters.map((roster) => <RosterBlock key={roster.discipline.id} roster={roster} />) : null}
    </section>
  );
}
