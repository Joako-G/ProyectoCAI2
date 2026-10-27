import { formatIsoDate } from '../../members/utils/member-format';
import { methodLabel } from '../../payments/utils/payment-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import type { RevenueReport } from '../types/report';
import { conceptTotalLabel, revenueTitle } from '../utils/report-format';

/** Presentational: the revenue of one period with the figures that add up to its total. */
export function RevenueResult({ report }: { report: RevenueReport }) {
  return (
    <section className="report-result report-sheet" aria-label="Resultado de recaudación">
      <h2>{revenueTitle(report.granularity)}</h2>
      <p className="report-result__range">Del {formatIsoDate(report.from)} al {formatIsoDate(report.to)}</p>
      <p className="report-result__total">
        <span>Total recaudado</span> <strong data-testid="revenue-total">{formatPesos(report.total)}</strong>
      </p>

      {report.receipts.length === 0 ? (
        <p className="members-page__notice">No hubo cobros en el período.</p>
      ) : (
        <>
          <table className="members-table">
            <caption className="visually-hidden">Recaudación por concepto</caption>
            <thead><tr className="table-head"><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead>
            <tbody>
              {report.byConcept.map(({ concept, total }) => (
                <tr key={concept}><td>{conceptTotalLabel(concept)}</td><td className="members-table__mono">{formatPesos(total)}</td></tr>
              ))}
            </tbody>
          </table>

          <table className="members-table">
            <caption className="visually-hidden">Recaudación por medio de pago</caption>
            <thead><tr className="table-head"><th scope="col">Medio de pago</th><th scope="col">Importe</th></tr></thead>
            <tbody>
              {report.byMethod.map(({ method, total }) => (
                <tr key={method}><td>{methodLabel(method)}</td><td className="members-table__mono">{formatPesos(total)}</td></tr>
              ))}
            </tbody>
          </table>

          <table className="members-table">
            <caption className="visually-hidden">Comprobantes del período</caption>
            <thead>
              <tr className="table-head">
                <th scope="col">N° de recibo</th><th scope="col">Fecha</th><th scope="col">Medio de pago</th><th scope="col">Importe</th>
              </tr>
            </thead>
            <tbody>
              {report.receipts.map((receipt) => (
                <tr key={receipt.receiptNumber}>
                  <td className="members-table__number">{receipt.receiptNumber}</td>
                  <td className="members-table__mono">{formatIsoDate(receipt.date)}</td>
                  <td>{methodLabel(receipt.method)}</td>
                  <td className="members-table__mono">{formatPesos(receipt.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.annulled.count > 0 ? (
        <p className="members-page__notice">
          Pagos anulados, no incluidos en el total: {report.annulled.count} por {formatPesos(report.annulled.total)}
        </p>
      ) : null}
    </section>
  );
}
