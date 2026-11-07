import { useEntriesToday } from '../hooks/useEntriesToday';
import { enteredLabel, entryTime, methodLabel, resultLabel, UNAVAILABLE_MESSAGE } from '../utils/entries-format';

export const DEFAULT_REFRESH_MS = 60_000;

/** The staff's view of today's entrances: how many came in and who, newest first. Read-only. */
export function EntriesToday({ refreshKey, refreshMs = DEFAULT_REFRESH_MS }: { /** Changes after each check so the list catches up. */ refreshKey: number; refreshMs?: number }) {
  const { state, reload } = useEntriesToday(refreshKey, refreshMs);
  const { day, problem } = state;

  return (
    <section className="card entries-today" aria-label="Ingresos de hoy">
      <h2 className="entries-today__title">Ingresos de hoy</h2>
      {problem?.kind === 'unavailable' ? <p className="members-page__notice">{UNAVAILABLE_MESSAGE}</p> : null}
      {problem?.kind === 'error' ? (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>{problem.message}</p>
          <button type="button" className="button button--secondary" onClick={() => void reload()}>Reintentar</button>
        </div>
      ) : null}
      {!day && !problem ? <p className="members-page__notice" role="status">Cargando los ingresos…</p> : null}
      {day ? (
        <>
          <p className="entries-today__count">{enteredLabel(day.count)}</p>
          {day.entries.length === 0 ? (
            <p className="members-page__notice">Todavía no ingresó nadie hoy.</p>
          ) : (
            <table className="members-table">
              <caption className="visually-hidden">Ingresos de hoy</caption>
              <thead>
                <tr className="table-head">
                  <th scope="col">Hora</th><th scope="col">Socio N°</th><th scope="col">Nombre</th>
                  <th scope="col">Método</th><th scope="col">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {day.entries.map((entry) => (
                  <tr key={entry.id} className={`entries-today__row entries-today__row--${entry.result}`}>
                    <td className="members-table__mono">{entryTime(entry.checkedAt)}</td>
                    <td className="members-table__mono">{entry.memberNumber ?? '—'}</td>
                    <td>{entry.name ?? '—'}</td>
                    <td>{methodLabel(entry.method)}</td>
                    <td>{resultLabel(entry.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}
