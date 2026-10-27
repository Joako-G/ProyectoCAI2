import { formatPesos } from '../../pricing/utils/pricing-format';
import type { CashCount } from '../types/cashcount';
import { describeVariance } from '../utils/cashcount-format';

const timeFormat = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

/** Presentational: the saved close of the day, read-only. */
export function ClosedDay({ close }: { close: CashCount }) {
  return (
    <section className="report-result" aria-label="Cierre del día">
      <p className="members-page__notice" role="status">El día está cerrado.</p>
      <p className="report-result__total"><span>Efectivo esperado</span> <strong>{formatPesos(close.expected.cash)}</strong></p>
      <p className="report-result__total"><span>Efectivo contado</span> <strong data-testid="closed-counted">{formatPesos(close.countedCash)}</strong></p>
      <p className="report-result__total"><span>Diferencia</span> <strong data-testid="closed-variance">{describeVariance(close.variance)}</strong></p>
      {close.varianceNote ? <p>Motivo: {close.varianceNote}</p> : null}
      <p className="report-result__range">Cerrado a las {timeFormat.format(new Date(close.closedAt))}</p>
    </section>
  );
}
