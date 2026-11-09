import { DeskCard } from '../../../components/desk/DeskCard';
import { DeskStat } from '../../../components/desk/DeskStat';
import { formatInstant } from '../../audit/utils/audit-format';
import { useBackups } from '../hooks/useBackups';
import {
  copiesMessage,
  databaseLine,
  DATABASE_MISSING_WARNING,
  destinationMessage,
  destinationProblemMessage,
  lastFailureMessage,
  PARTIAL_RUN_MESSAGE,
} from '../utils/backup-format';

/** Container of the daily backup (RNF-03): when the last copy ran, where copies go, and a copy on demand. */
export function BackupView() {
  const { state, run, reload, makeCopy } = useBackups();

  if (state.phase === 'loading') {
    return <section className="card members-page" aria-label="Respaldo"><p className="members-page__notice" role="status">Cargando el estado del respaldo…</p></section>;
  }
  if (state.phase === 'error') {
    return (
      <section className="card members-page" aria-label="Respaldo">
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudo cargar el estado del respaldo.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      </section>
    );
  }

  const { status } = state;
  const running = run.phase === 'running' || status.running;
  const { state: destinationState } = status.destination;
  const lastCopyDatabase = status.database.lastCopy;
  return (
    <div className="desk" role="region" aria-label="Respaldo">
      {destinationState !== 'ready' && (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>{destinationProblemMessage(destinationState)}</p>
        </div>
      )}
      {status.lastFailure && (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>{lastFailureMessage(status.lastFailure.at)}</p>
        </div>
      )}
      {lastCopyDatabase?.state === 'failed' && (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>{DATABASE_MISSING_WARNING}</p>
        </div>
      )}
      <div className="desk__grid desk__grid--even">
        <DeskCard label="Estado" title="Último respaldo" ariaLabel="Estado del respaldo">
          {status.lastSuccessAt ? (
            <div className="desk-stats">
              <DeskStat label="Último respaldo correcto" value={formatInstant(status.lastSuccessAt)} primary />
            </div>
          ) : (
            destinationState === 'ready' && <p className="members-page__notice">Todavía no hay ningún respaldo.</p>
          )}
          {lastCopyDatabase && <p className="desk-card__line">{databaseLine(lastCopyDatabase)}</p>}
          {destinationState === 'ready' && <p className="desk-card__line">{copiesMessage(status.copies, status.keep, status.keepRecent)}</p>}
        </DeskCard>
        <DeskCard label="Destino" title="Dónde se guardan" ariaLabel="Destino del respaldo">
          <p className="desk-card__line">
            El sistema copia todos sus datos una vez por día, mientras está encendido. Cada copia queda en su propia carpeta con la fecha.
          </p>
          <p className="desk-card__line">{destinationMessage(status.destination.isDefault)}</p>
          {run.phase === 'error' && (
            <div className="members-page__notice members-page__notice--error" role="alert"><p>{run.message}</p></div>
          )}
          {run.phase === 'done' && <p className="members-page__notice" role="status">{run.partial ? PARTIAL_RUN_MESSAGE : 'Respaldo realizado.'}</p>}
          <button type="button" className="desk-primary desk-primary--auto" disabled={running} onClick={() => void makeCopy()}>
            {running ? 'Haciendo el respaldo…' : 'Hacer un respaldo ahora'}
          </button>
        </DeskCard>
      </div>
    </div>
  );
}
