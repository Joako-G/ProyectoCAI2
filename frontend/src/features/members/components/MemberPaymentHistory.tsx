import type { Discipline } from '../../disciplines/types/discipline';
import { ReceiptPdfLink } from '../../payments/components/ReceiptPdfLink';
import type { Payment } from '../../payments/types/payment';
import { lineLabel, methodLabel } from '../../payments/utils/payment-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import { useMemberPaymentHistory } from '../hooks/useMemberPaymentHistory';
import { formatIsoDate } from '../utils/member-format';

interface MemberPaymentHistoryProps {
  memberId: string;
  disciplines: readonly Discipline[];
}

/** Newest payment first; the receipt number breaks ties between payments of the same day. */
function newestFirst(payments: readonly Payment[]): Payment[] {
  return [...payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.receiptNumber - a.receiptNumber);
}

/**
 * Read-only payment history of the member record, shown under the member sheet. Annulled payments stay listed
 * (RNF-08) and an inactive member keeps its history (RF-05, RF-06). Rendered only for users with `payments:read`;
 * a failed read shows one short line and never blocks the record.
 */
export function MemberPaymentHistory({ memberId, disciplines }: MemberPaymentHistoryProps) {
  const state = useMemberPaymentHistory(memberId);

  return (
    <section className="card member-card" aria-label="Historial de pagos">
      <h3 className="member-card__title">Historial de pagos</h3>

      {state.phase === 'loading' ? <p className="member-card__note" role="status">Cargando historial…</p> : null}
      {state.phase === 'error' ? <p className="member-card__note member-card__note--error">{state.message}</p> : null}
      {state.phase === 'ready' && state.payments.length === 0 ? <p className="member-card__note">Todavía no hay pagos registrados.</p> : null}
      {state.phase === 'ready' && state.payments.length > 0 ? (
        <table className="members-table members-table--stack">
          <caption className="visually-hidden">Pagos del socio</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Comprobante</th>
              <th scope="col">Fecha</th>
              <th scope="col">Detalle</th>
              <th scope="col">Total</th>
              <th scope="col">Medio</th>
              <th scope="col">Estado</th>
              <th scope="col">Recibo</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst(state.payments).map((payment) => (
              <tr key={payment.id}>
                <td className="members-table__mono" data-label="Comprobante">{payment.receiptNumber}</td>
                <td className="members-table__mono" data-label="Fecha">{formatIsoDate(payment.paymentDate)}</td>
                <td data-label="Detalle">
                  <ul className="member-payment-lines">
                    {payment.lines.map((line, index) => (
                      <li key={`${line.kind}-${line.period}-${line.disciplineId ?? ''}-${index}`}>{lineLabel(line, disciplines)}</li>
                    ))}
                  </ul>
                </td>
                <td data-label="Total">{formatPesos(payment.total)}</td>
                <td data-label="Medio">{methodLabel(payment.method)}</td>
                <td data-label="Estado">
                  {payment.annulment ? 'Anulado' : 'Vigente'}
                  {payment.annulment ? <p className="payments-meta">Motivo: {payment.annulment.reason}</p> : null}
                </td>
                <td data-label="Recibo">
                  <ReceiptPdfLink paymentId={payment.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
