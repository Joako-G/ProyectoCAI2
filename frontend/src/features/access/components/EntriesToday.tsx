import type { EntriesTodayState } from '../hooks/useEntriesToday';
import { entryTime, methodLabel, recordsLabel, resultChip, UNAVAILABLE_MESSAGE } from '../utils/entries-format';

/** "Accesos de hoy" as in the approved "Ventanilla": every check of the day, newest first, with a colored result chip. Read-only. */
export function EntriesToday({ state, onRetry }: { state: EntriesTodayState; onRetry: () => void }) {
  const { day, problem } = state;

  return (
    <section className="entries-card" aria-label="Accesos de hoy">
      <div className="entries-card__head">
        <h2 className="entries-card__title">Accesos de hoy</h2>
        {day ? <span className="entries-card__count">{recordsLabel(day.entries.length)}</span> : null}
      </div>
      {problem?.kind === 'unavailable' ? <p className="members-page__notice">{UNAVAILABLE_MESSAGE}</p> : null}
      {problem?.kind === 'error' ? (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>{problem.message}</p>
          <button type="button" className="button button--secondary" onClick={onRetry}>Reintentar</button>
        </div>
      ) : null}
      {!day && !problem ? <p className="members-page__notice" role="status">Cargando los accesos…</p> : null}
      {day && day.entries.length === 0 ? <p className="members-page__notice">Todavía no hubo controles hoy.</p> : null}
      {day && day.entries.length > 0 ? (
        <table className="entries-card__table">
          <thead>
            <tr>
              <th scope="col">HORA</th>
              <th scope="col">N° SOCIO</th>
              <th scope="col">SOCIO</th>
              <th scope="col">MEDIO</th>
              <th scope="col" className="entries-card__right">RESULTADO</th>
            </tr>
          </thead>
          <tbody>
            {day.entries.map((entry) => {
              const chip = resultChip(entry.result);
              return (
                <tr key={entry.id}>
                  <td className="entries-card__time">{entryTime(entry.checkedAt)}</td>
                  <td className="entries-card__number">{entry.memberNumber ?? '—'}</td>
                  <td>{entry.name ?? '—'}</td>
                  <td className="entries-card__method">{methodLabel(entry.method)}</td>
                  <td className="entries-card__right"><span className={`entries-card__chip entries-card__chip--${entry.result}`}>{chip}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
