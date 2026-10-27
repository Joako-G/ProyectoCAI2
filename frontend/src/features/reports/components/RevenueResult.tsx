import { useMemo } from 'react';
import type { CashCount } from '../../cashcount/types/cashcount';
import { formatIsoDate } from '../../members/utils/member-format';
import { methodLabel } from '../../payments/utils/payment-format';
import type { RevenueReport } from '../types/report';
import { conceptTotalLabel, formatAmount, formatShare, issuedLabel, rangeLabel, revenueTitle } from '../utils/report-format';
import { revenueMismatches } from '../utils/report-totals';
import { CashClosing } from './CashClosing';
import { ReportFrame } from './ReportFrame';
import { ReportLetterhead } from './ReportLetterhead';
import { SignatureBlock } from './SignatureBlock';

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** The TOTAL row closing a table: the label spans the leading columns and each cell is one figure. */
function TotalRow({ cells, span = 1 }: { cells: React.ReactNode[]; span?: number }) {
  return (
    <tr className="report-table__total">
      <th scope="row" colSpan={span}>TOTAL</th>
      {cells.map((cell, index) => <td key={index} className="report-mono report-amount">{cell}</td>)}
    </tr>
  );
}

/** Presentational: the revenue of one period with the figures that add up to its total, ready to print and sign. */
export function RevenueResult({ report, issuedBy, cashCount }: { report: RevenueReport; issuedBy?: string; cashCount?: CashCount }) {
  const issuedAt = useMemo(() => new Date(), [report]);
  const mismatches = revenueMismatches(report);
  const operations = new Map(report.operationsByConcept.map(({ concept, count }) => [concept, count]));
  const cashExpected = report.byMethod.find(({ method }) => method === 'cash')?.total ?? 0;
  const conceptSum = sum(report.byConcept.map((row) => row.total));
  const methodSum = sum(report.byMethod.map((row) => row.total));
  const receiptSum = sum(report.receipts.map((row) => row.total));

  return (
    <section className="report-sheet" aria-label="Resultado de recaudación">
      <ReportFrame header={<ReportLetterhead issuedBy={issuedBy} issuedAt={issuedAt} />}>
      <div className="report-head">
        <h2 className="report-title report-title--screen-only">{revenueTitle(report.granularity)}</h2>
        <p className="report-result__range">{rangeLabel(report)}</p>
        <p className="report-result__total">
          <span>Total recaudado</span> <strong data-testid="revenue-total">{formatAmount(report.total)}</strong>
        </p>

        {mismatches.length > 0 ? (
          <p className="report-warning" role="alert">
            <strong>Atención: los totales no coinciden.</strong> No suma el total recaudado: {mismatches.join(', ')}. No use este informe hasta revisarlo.
          </p>
        ) : null}

        <dl className="report-summary">
          <div><dt>Recibos emitidos</dt><dd>{report.issued ? `${issuedLabel(report.issued)} (${report.issued.count})` : 'Ninguno'}</dd></div>
          <div><dt>Recibos válidos</dt><dd>{report.receipts.length}</dd></div>
          <div><dt>Recibos anulados</dt><dd>{report.annulled.count}</dd></div>
        </dl>
        {report.annulled.count > 0 ? (
          <p className="members-page__notice">
            Pagos anulados, no incluidos en el total: {report.annulled.count} por {formatAmount(report.annulled.total)}
          </p>
        ) : null}

      </div>

      {report.receipts.length === 0 ? (
        <p className="members-page__notice">No hubo cobros en el período.</p>
      ) : (
        <>
          <section className="report-section" aria-label="Por concepto">
            <h3 className="report-section__title">Por concepto</h3>
            <table className="members-table report-table">
              <caption className="visually-hidden">Recaudación por concepto</caption>
              <thead>
                <tr className="table-head"><th scope="col">Concepto</th><th scope="col" className="report-amount">Cant. de operaciones</th><th scope="col" className="report-amount">% del total</th><th scope="col" className="report-amount">Importe</th></tr>
              </thead>
              <tbody>
                {report.byConcept.map(({ concept, total }) => (
                  <tr key={concept}>
                    <td>{conceptTotalLabel(concept)}</td>
                    <td className="report-mono report-amount">{operations.get(concept) ?? 0}</td>
                    <td className="report-mono report-amount">{formatShare(total, report.total)}</td>
                    <td className="report-mono report-amount">{formatAmount(total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow cells={[sum(report.operationsByConcept.map((row) => row.count)), formatShare(conceptSum, report.total), formatAmount(conceptSum)]} />
              </tfoot>
            </table>
          </section>

          <section className="report-section" aria-label="Por medio de pago">
            <h3 className="report-section__title">Por medio de pago</h3>
            <table className="members-table report-table">
              <caption className="visually-hidden">Recaudación por medio de pago</caption>
              <thead><tr className="table-head"><th scope="col">Medio de pago</th><th scope="col" className="report-amount">% del total</th><th scope="col" className="report-amount">Importe</th></tr></thead>
              <tbody>
                {report.byMethod.map(({ method, total }) => (
                  <tr key={method}>
                    <td>{methodLabel(method)}</td>
                    <td className="report-mono report-amount">{formatShare(total, report.total)}</td>
                    <td className="report-mono report-amount">{formatAmount(total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow cells={[formatShare(methodSum, report.total), formatAmount(methodSum)]} />
              </tfoot>
            </table>
          </section>

          <section className="report-section report-section--receipts" aria-label="Detalle de recibos">
            <h3 className="report-section__title">Detalle de recibos</h3>
            <table className="members-table report-table report-table--receipts">
              <caption className="visually-hidden">Comprobantes del período</caption>
              <thead>
                <tr className="table-head">
                  <th scope="col">N° de recibo</th><th scope="col">Fecha</th><th scope="col">Socio</th><th scope="col">Concepto</th><th scope="col">Medio de pago</th><th scope="col" className="report-amount">Importe</th>
                </tr>
              </thead>
              <tbody>
                {report.receipts.map((receipt) => (
                  <tr key={receipt.receiptNumber}>
                    <td className="report-mono">{receipt.receiptNumber}</td>
                    <td className="report-mono">{formatIsoDate(receipt.date)}</td>
                    <td>{receipt.member ? `${receipt.member.fullName} (N° ${receipt.member.memberNumber})` : '—'}</td>
                    <td>{receipt.concepts.map(conceptTotalLabel).join(', ')}</td>
                    <td>{methodLabel(receipt.method)}</td>
                    <td className="report-mono report-amount">{formatAmount(receipt.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow span={5} cells={[formatAmount(receiptSum)]} />
              </tfoot>
            </table>
          </section>
        </>
      )}

      {report.granularity === 'daily' ? <CashClosing expectedCash={cashExpected} cashCount={cashCount} /> : null}
      <SignatureBlock />
      </ReportFrame>
    </section>
  );
}
