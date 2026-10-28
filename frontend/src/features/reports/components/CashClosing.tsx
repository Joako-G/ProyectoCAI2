import type { CashCount } from '../../cashcount/types/cashcount';
import { describeVariance } from '../../cashcount/utils/cashcount-format';
import { formatAmount } from '../utils/report-format';

/**
 * Presentational: expected cash against counted cash for a day. When the day has no saved Arqueo the
 * counted cash and the difference stay as blank lines to fill in by hand on the printed sheet.
 */
export function CashClosing({ expectedCash, cashCount }: { expectedCash: number; cashCount?: CashCount }) {
  return (
    <section className="report-section" aria-label="Cierre de caja">
      <h3 className="report-section__title">Cierre de caja</h3>
      <dl className="report-closing">
        <div><dt>Efectivo esperado</dt><dd className="report-mono">{formatAmount(expectedCash)}</dd></div>
        <div>
          <dt>Efectivo contado</dt>
          <dd className="report-mono">{cashCount ? formatAmount(cashCount.countedCash) : <span className="report-blank">$</span>}</dd>
        </div>
        <div>
          <dt>Diferencia</dt>
          <dd className="report-mono">
            {cashCount
              ? <>{formatAmount(cashCount.variance)} <span className="report-closing__note">({describeVariance(cashCount.variance)})</span></>
              : <span className="report-blank">$</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}
