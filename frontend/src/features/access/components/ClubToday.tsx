import type { DayCounts } from '../types/entries';

/** "Hoy en el club": the day's checks by result. A dash while the day is not loaded. */
export function ClubToday({ counts }: { counts?: DayCounts }) {
  const value = (count: number | undefined) => (count === undefined ? '—' : String(count));
  return (
    <section className="club-today" aria-label="Hoy en el club">
      <span className="club-today__label">HOY EN EL CLUB</span>
      <div className="club-today__rows">
        <div className="club-today__row"><span>Accesos autorizados</span><strong>{value(counts?.entered)}</strong></div>
        <div className="club-today__row"><span>Con aviso de cuota</span><strong className="club-today__warned">{value(counts?.warned)}</strong></div>
        <div className="club-today__row"><span>No habilitados</span><strong className="club-today__refused">{value(counts?.refused)}</strong></div>
      </div>
    </section>
  );
}
