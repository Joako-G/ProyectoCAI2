import { useState, type FormEvent } from 'react';
import { formatIsoDate } from '../../members/utils/member-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import type { Payment } from '../types/payment';
import { methodLabel } from '../utils/payment-format';

interface PaymentHistoryProps {
  payments: Payment[];
  /** Whether to offer Anular; only for holders of `payments:annul`. */
  canAnnul: boolean;
  /** Failure of the last annulment, owned by the container so it survives the history re-read. */
  error?: string;
  onOpenReceipt: (payment: Payment) => void;
  /** Resolves to whether the server confirmed the annulment; never rejects. */
  onAnnul: (payment: Payment, reason: string) => Promise<boolean>;
}

/** The member's payments, oldest receipt first, with the annulment action for those allowed (RF-15). */
export function PaymentHistory({ payments, canAnnul, error, onOpenReceipt, onAnnul }: PaymentHistoryProps) {
  const [annulling, setAnnulling] = useState<string>();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function open(id: string) {
    setAnnulling(id);
    setReason('');
    setReasonError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, payment: Payment) {
    event.preventDefault();
    if (busy) return;
    if (reason.trim() === '') {
      setReasonError('Indique el motivo de la anulación.');
      return;
    }
    setReasonError(undefined);
    setBusy(true);
    const annulled = await onAnnul(payment, reason.trim());
    setBusy(false);
    if (annulled) setAnnulling(undefined);
  }

  return (
    <section className="card payments-section" aria-label="Historial de pagos">
      <h2 className="payments-section__title">Historial de pagos</h2>
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      {payments.length === 0 ? <p className="members-page__notice">Todavía no hay pagos registrados.</p> : (
        <table className="members-table">
          <caption className="visually-hidden">Pagos del socio</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Comprobante</th>
              <th scope="col">Fecha</th>
              <th scope="col">Total</th>
              <th scope="col">Medio</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="members-table__mono">{payment.receiptNumber}</td>
                <td className="members-table__mono">{formatIsoDate(payment.paymentDate)}</td>
                <td>{formatPesos(payment.total)}</td>
                <td>{methodLabel(payment.method)}</td>
                <td>{payment.annulment ? 'Anulado' : 'Vigente'}</td>
                <td>
                  <button type="button" className="button button--secondary" aria-label={`Ver comprobante ${payment.receiptNumber}`} onClick={() => onOpenReceipt(payment)}>
                    Ver comprobante
                  </button>
                  {payment.annulment ? <p className="payments-meta">Motivo: {payment.annulment.reason}</p> : null}
                  {canAnnul && !payment.annulment ? (
                    <button type="button" className="button button--secondary" aria-label={`Anular comprobante ${payment.receiptNumber}`} onClick={() => open(payment.id)}>
                      Anular
                    </button>
                  ) : null}
                  {canAnnul && !payment.annulment && annulling === payment.id ? (
                    <form className="member-form" noValidate onSubmit={(event) => handleSubmit(event, payment)}>
                      <label>
                        Motivo de la anulación
                        <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
                      </label>
                      {reasonError ? <p className="form-alert" role="alert">{reasonError}</p> : null}
                      <div className="member-form__actions">
                        <button type="submit" className="button button--primary" disabled={busy}>{busy ? 'Anulando…' : 'Confirmar anulación'}</button>
                        <button type="button" className="button button--secondary" disabled={busy} onClick={() => setAnnulling(undefined)}>Cancelar</button>
                      </div>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
