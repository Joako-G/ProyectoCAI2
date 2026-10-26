import { useRef, useState } from 'react';
import { catalogDisciplines, useDisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import type { Member } from '../../members/types/member';
import { useMemberAccount } from '../hooks/useMemberAccount';
import { annulPayment, previewCharge, registerPayment } from '../services/payments-api';
import type { Payment, PreviewRequest, RegisterDraft } from '../types/payment';
import { conceptKey, describePaymentError, isAmbiguousWriteFailure, newRequestId } from '../utils/payment-format';
import { AccountSummary } from './AccountSummary';
import { PaymentForm } from './PaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { ReceiptView } from './ReceiptView';

interface MemberPaymentsProps {
  member: Member;
  /** Whether the user may register payments (`payments:collect`). */
  canCollect: boolean;
  /** Whether the user may annul payments (`payments:annul`). */
  canAnnul: boolean;
}

/** Container for one member: account, collecting form, receipt and history, re-read after every write. */
export function MemberPayments({ member, canCollect, canAnnul }: MemberPaymentsProps) {
  const { state, stale, reload, refresh } = useMemberAccount(member.id);
  const catalog = useDisciplineCatalog();
  const disciplines = catalogDisciplines(catalog);
  const [receipt, setReceipt] = useState<Payment>();
  const [paymentError, setPaymentError] = useState<string>();
  const [annulError, setAnnulError] = useState<string>();
  // Bumped after a confirmed payment so the form starts clean even if the re-read fails.
  const [epoch, setEpoch] = useState(0);
  // The idempotency key of the cobro being prepared. It lives here, not in the form, so it survives the
  // form remounting after a re-read: a retry of the same concepts reuses it and can never charge twice.
  const pending = useRef<{ signature: string; requestId: string } | undefined>(undefined);

  if (state.phase === 'loading') {
    return <p className="members-page__notice" role="status">Cargando cuenta…</p>;
  }

  if (state.phase === 'error') {
    return (
      <div className="members-page__notice members-page__notice--error" role="alert">
        <p><strong>No se pudo cargar la cuenta del socio.</strong> {state.message}</p>
        <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
      </div>
    );
  }

  const { account, history } = state;
  const canPay = canCollect && member.status === 'active';
  // The form restarts clean whenever anything it was built from changes: a confirmed payment (epoch), the
  // owed concepts, or the history including annulments (an annulment makes concepts owed again).
  const formKey = [epoch, ...account.owed.flatMap((entry) => entry.concepts.map(conceptKey)), ...history.map((payment) => `${payment.id}${payment.annulment ? '!' : ''}`)].join('|');

  // Every write re-reads the account and history so the screen shows what the server holds. A failed write
  // whose outcome is unknown or stale is re-read too, and its error still reaches the caller.
  async function writeAndRefresh<T>(write: Promise<T>): Promise<T> {
    try {
      const result = await write;
      await refresh('after-save');
      return result;
    } catch (error) {
      if (isAmbiguousWriteFailure(error)) await refresh('after-failure');
      throw error;
    }
  }

  // Same concepts means same cobro; changing the selection makes a new one. The method is not part of it:
  // the server returns the payment it stored for the key, whatever method a retry names.
  function requestIdFor(draft: RegisterDraft): string {
    const signature = [draft.memberId, ...draft.concepts.map(conceptKey)].sort().join('|');
    if (pending.current?.signature !== signature) pending.current = { signature, requestId: newRequestId() };
    return pending.current.requestId;
  }

  async function handleRegister(draft: RegisterDraft) {
    setPaymentError(undefined);
    try {
      const payment = await writeAndRefresh(registerPayment({ ...draft, requestId: requestIdFor(draft) }));
      pending.current = undefined;
      setReceipt(payment);
      setEpoch((current) => current + 1);
    } catch (error) {
      setPaymentError(describePaymentError(error));
    }
  }

  async function handleAnnul(payment: Payment, reason: string): Promise<boolean> {
    setAnnulError(undefined);
    try {
      await writeAndRefresh(annulPayment(payment.id, reason));
      setReceipt((current) => (current?.id === payment.id ? undefined : current));
      return true;
    } catch (error) {
      setAnnulError(describePaymentError(error));
      return false;
    }
  }

  return (
    <div className="payments-member">
      {stale ? (
        <div className="form-alert payments-stale" role="alert">
          {/* Only a write the server confirmed may be called registered. */}
          <p>
            {stale === 'after-save'
              ? 'El pago se registró, pero no se pudo actualizar la cuenta. Reintentá para ver los datos al día.'
              : 'No se pudo actualizar la cuenta con los datos del servidor. Reintentá para verlos al día.'}
          </p>
          <button type="button" className="button button--secondary" onClick={() => refresh(stale)}>Reintentar</button>
        </div>
      ) : null}
      <AccountSummary member={member} account={account} disciplines={disciplines} showOwed={!canPay} />
      {member.status === 'inactive' ? (
        <p className="form-alert" role="status">Este socio está dado de baja: no puede registrar pagos.</p>
      ) : null}
      {receipt ? <ReceiptView payment={receipt} member={member} disciplines={disciplines} onClose={() => setReceipt(undefined)} /> : null}
      {canPay ? (
        <PaymentForm
          key={formKey}
          memberId={member.id}
          account={account}
          disciplines={disciplines}
          error={paymentError}
          onPreview={(request: PreviewRequest) => previewCharge(request)}
          onRegister={handleRegister}
        />
      ) : null}
      <PaymentHistory payments={history} canAnnul={canAnnul} error={annulError} onOpenReceipt={setReceipt} onAnnul={handleAnnul} />
    </div>
  );
}
