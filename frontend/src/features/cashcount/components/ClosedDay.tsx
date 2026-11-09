import { DeskStat } from '../../../components/desk/DeskStat';
import { formatPesos } from '../../pricing/utils/pricing-format';
import type { CashCount } from '../types/cashcount';
import { describeVariance, varianceTone } from '../utils/cashcount-format';

const timeFormat = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

/** Presentational: the saved close of the day, read-only. */
export function ClosedDay({ close }: { close: CashCount }) {
  return (
    <section className="desk-form" aria-label="Cierre del día">
      <p className="members-page__notice" role="status">El día está cerrado.</p>
      <div className="desk-stats">
        <DeskStat label="Efectivo esperado" value={formatPesos(close.expected.cash)} />
        <DeskStat label="Efectivo contado" value={formatPesos(close.countedCash)} primary testId="closed-counted" />
      </div>
      <p className={`desk-verdict desk-verdict--${varianceTone(close.variance)}`}>
        <span>Diferencia</span> <strong data-testid="closed-variance">{describeVariance(close.variance)}</strong>
      </p>
      {close.varianceNote ? <p className="desk-note">Motivo: {close.varianceNote}</p> : null}
      <p className="desk-note">Cerrado a las {timeFormat.format(new Date(close.closedAt))}</p>
    </section>
  );
}
