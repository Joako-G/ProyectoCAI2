import { useEffect, useState } from 'react';
import type { Discipline } from '../../disciplines/types/discipline';
import type { Member } from '../../members/types/member';
import { formatPesos } from '../../pricing/utils/pricing-format';
import { previewEnrollment } from '../../payments/services/payments-api';
import type { Charge, PaymentMethod } from '../../payments/types/payment';
import { describePaymentError, lineLabel, PAYMENT_METHODS } from '../../payments/utils/payment-format';

interface EnrollmentPaymentStepProps {
  disciplineIds: string[];
  disciplines: Discipline[];
  memberName: string;
  saving: boolean;
  /** Set once the member exists but its collection failed: the member can no longer be edited from here. */
  savedMember?: Member;
  error?: string;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: (method: PaymentMethod, charge: Charge) => void;
  /** Leaves the member as saved and uncollected; the collection can be done later from Cobros. */
  onSkip: () => void;
}

/** Last step: what the secretary must collect, the payment method and the button that creates the member. */
export function EnrollmentPaymentStep({
  disciplineIds,
  disciplines,
  memberName,
  saving,
  savedMember,
  error,
  onBack,
  onCancel,
  onConfirm,
  onSkip,
}: EnrollmentPaymentStepProps) {
  const [charge, setCharge] = useState<Charge>();
  const [previewError, setPreviewError] = useState<string>();
  const [method, setMethod] = useState<PaymentMethod | ''>('');

  useEffect(() => {
    const controller = new AbortController();
    previewEnrollment(disciplineIds, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setCharge(result);
      },
      (caught: unknown) => {
        if (!controller.signal.aborted) setPreviewError(describePaymentError(caught));
      },
    );
    return () => controller.abort();
  }, [disciplineIds]);

  return (
    <div className="member-form">
      <p className="member-form__hint">
        Cobrá {memberName} lo que se detalla y recién después presioná {savedMember ? 'Reintentar cobro' : 'Crear socio'}.
      </p>

      {savedMember ? (
        <p className="form-alert" role="alert">
          El socio se guardó (N° {savedMember.memberNumber}), pero el cobro no se pudo registrar. Reintentá el cobro o cobralo después desde la sección Cobros.
          {error ? ` ${error}` : ''}
        </p>
      ) : error ? (
        <p className="form-alert" role="alert">{error}</p>
      ) : null}
      {previewError ? <p className="form-alert" role="alert">{previewError}</p> : null}
      {!charge && !previewError ? <p className="members-page__notice" role="status">Calculando el total…</p> : null}

      {charge ? (
        <>
          <table className="members-table payments-preview">
            <caption className="visually-hidden">Detalle del cobro</caption>
            <thead>
              <tr className="table-head">
                <th scope="col">Concepto</th>
                <th scope="col">Importe</th>
              </tr>
            </thead>
            <tbody>
              {charge.lines.map((line, index) => (
                // A line has no identity besides its position in the server's answer.
                <tr key={index}>
                  <td>{lineLabel(line, disciplines)}</td>
                  <td>{formatPesos(line.amount)}</td>
                </tr>
              ))}
              <tr className="receipt__total">
                <th scope="row">Total</th>
                <td>{formatPesos(charge.total)}</td>
              </tr>
            </tbody>
          </table>
          <div className="segmented" role="radiogroup" aria-label="Medio de pago">
            {PAYMENT_METHODS.map((option) => (
              <label key={option.value} className="segmented__option">
                <input type="radio" name="enrollment-payment-method" value={option.value} checked={method === option.value} disabled={saving} onChange={() => setMethod(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}

      <div className="member-form__actions">
        <button type="button" className="button button--primary" disabled={!charge || !method || saving} onClick={() => charge && method && onConfirm(method, charge)}>
          {saving ? 'Guardando…' : savedMember ? 'Reintentar cobro' : 'Crear socio'}
        </button>
        <button type="button" className="button button--secondary" disabled={saving || savedMember !== undefined} onClick={onBack}>
          Volver
        </button>
        {savedMember ? (
          <button type="button" className="button button--secondary" disabled={saving} onClick={onSkip}>
            Ir al socio
          </button>
        ) : null}
        <button type="button" className="button button--secondary" disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
