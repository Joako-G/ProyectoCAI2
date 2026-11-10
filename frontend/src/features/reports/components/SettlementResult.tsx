import { useMemo } from 'react';
import { formatPeriod, formatPesos } from '../../pricing/utils/pricing-format';
import type { DisciplineSettlement } from '../types/report';
import { ReportFrame } from './ReportFrame';
import { ReportLetterhead } from './ReportLetterhead';

/** Presentational: who paid a discipline's fee for a month and what that fee came to. No DNI, by the club's decision. */
export function SettlementResult({ report, issuedBy }: { report: DisciplineSettlement; issuedBy?: string }) {
  const issuedAt = useMemo(() => new Date(), [report]);
  const month = formatPeriod(report.period);
  return (
    <section className="report-sheet" aria-label="Resultado de liquidación">
      <ReportFrame header={<ReportLetterhead issuedBy={issuedBy} issuedAt={issuedAt} />}>
      <div className="report-head">
        <h2 className="report-title">Liquidación de {report.discipline.name}</h2>
        <p className="report-result__range">{report.discipline.name}, {month}</p>
        <p className="report-result__total">
          <span>Cuotas de la disciplina</span> <strong data-testid="settlement-fees">{formatPesos(report.feeTotal)}</strong>
        </p>
        <p className="report-result__total report-result__total--secondary">
          <span>Recargos por pago tardío (aparte)</span> <strong data-testid="settlement-surcharges">{formatPesos(report.surchargeTotal)}</strong>
        </p>
      </div>

      {report.students.length === 0 ? (
        <p className="members-page__notice">Ningún socio pagó la cuota de esta disciplina en el mes elegido.</p>
      ) : (
        <section className="report-section report-section--receipts" aria-label="Socios que pagaron">
          <h3 className="report-section__title report-title--screen-only">Socios que pagaron</h3>
          <table className="members-table members-table--stack report-table">
            <caption className="visually-hidden">Socios de {report.discipline.name} con la cuota de {month} paga</caption>
            <thead>
              <tr className="table-head"><th scope="col">Nombre</th><th scope="col">N° de socio</th><th scope="col">Mes</th></tr>
            </thead>
            <tbody>
              {report.students.map((student) => (
                <tr key={student.memberNumber}>
                  <td><span className="members-table__name">{student.fullName}</span></td>
                  <td className="members-table__number" data-label="N° de socio">{student.memberNumber}</td>
                  <td className="members-table__mono" data-label="Mes">{formatPeriod(student.period)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      </ReportFrame>
    </section>
  );
}
