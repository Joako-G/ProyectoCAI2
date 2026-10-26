import type { Discipline } from '../../disciplines/types/discipline';
import type { Member } from '../../members/types/member';
import { formatIsoDate } from '../../members/utils/member-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import type { Payment } from '../types/payment';
import { lineLabel, methodLabel } from '../utils/payment-format';

interface ReceiptViewProps {
  payment: Payment;
  member: Member;
  disciplines: Discipline[];
  onClose: () => void;
}

/** Presentational printable receipt (RF-14). The print stylesheet shows only this block. */
export function ReceiptView({ payment, member, disciplines, onClose }: ReceiptViewProps) {
  return (
    <section className="card receipt" aria-label="Comprobante">
      <h2 className="receipt__title">Comprobante N° {payment.receiptNumber}</h2>
      {payment.annulment ? <p className="receipt__annulled">Anulado: {payment.annulment.reason}</p> : null}
      <dl className="receipt__meta">
        <div><dt>Fecha</dt><dd>{formatIsoDate(payment.paymentDate)}</dd></div>
        <div><dt>Socio</dt><dd>{member.firstName} {member.lastName} · N° {member.memberNumber}</dd></div>
        <div><dt>Medio de pago</dt><dd>{methodLabel(payment.method)}</dd></div>
      </dl>
      <table className="members-table">
        <caption className="visually-hidden">Conceptos del comprobante</caption>
        <thead>
          <tr className="table-head">
            <th scope="col">Concepto</th>
            <th scope="col">Importe</th>
          </tr>
        </thead>
        <tbody>
          {payment.lines.map((line, index) => (
            // A line has no identity besides its position inside the stored receipt.
            <tr key={index}>
              <td>{lineLabel(line, disciplines)}</td>
              <td>{formatPesos(line.amount)}</td>
            </tr>
          ))}
          <tr className="receipt__total">
            <th scope="row">Total</th>
            <td>{formatPesos(payment.total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="receipt__actions">
        <button type="button" className="button button--primary" onClick={() => window.print()}>Imprimir</button>
        <button type="button" className="button button--secondary" onClick={onClose}>Cerrar</button>
      </div>
    </section>
  );
}
