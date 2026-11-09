import { DeskCard } from '../../../components/desk/DeskCard';
import { DeskStat } from '../../../components/desk/DeskStat';
import { methodLabel } from '../../payments/utils/payment-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import { conceptTotalLabel } from '../../reports/utils/report-format';
import type { CashCountExpected } from '../types/cashcount';

/** Presentational: what the system expected to have taken on the day, by payment method and concept. */
export function ExpectedTotals({ expected }: { expected: CashCountExpected }) {
  return (
    <DeskCard label="Esperado del día" ariaLabel="Totales esperados">
      <div className="desk-stats">
        <DeskStat label="Efectivo esperado" value={formatPesos(expected.cash)} primary testId="expected-cash" />
        <DeskStat label="Total esperado del día" value={formatPesos(expected.total)} />
      </div>

      <div className="desk-card__scroll">
        <table className="members-table">
          <caption className="visually-hidden">Esperado por medio de pago</caption>
          <thead><tr className="table-head"><th scope="col">Medio de pago</th><th scope="col">Importe</th></tr></thead>
          <tbody>
            {expected.byMethod.map(({ method, total }) => (
              <tr key={method}><td>{methodLabel(method)}</td><td className="members-table__mono">{formatPesos(total)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="desk-card__scroll">
        <table className="members-table">
          <caption className="visually-hidden">Esperado por concepto</caption>
          <thead><tr className="table-head"><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead>
          <tbody>
            {expected.byConcept.map(({ concept, total }) => (
              <tr key={concept}><td>{conceptTotalLabel(concept)}</td><td className="members-table__mono">{formatPesos(total)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </DeskCard>
  );
}
