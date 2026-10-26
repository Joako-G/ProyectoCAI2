import { useRef, useState } from 'react';
import type { Discipline } from '../../disciplines/types/discipline';
import { formatPeriod, formatPesos } from '../../pricing/utils/pricing-format';
import type { Charge, ChargeConcept, MemberAccount, PaymentMethod, PreviewRequest, RegisterDraft } from '../types/payment';
import { conceptKey, conceptLabel, describePaymentError, lineLabel, PAYMENT_METHODS } from '../utils/payment-format';

interface PaymentFormProps {
  memberId: string;
  account: MemberAccount;
  disciplines: Discipline[];
  /** Failure of the last registration, owned by the container so it survives the account re-read. */
  error?: string;
  onPreview: (request: PreviewRequest) => Promise<Charge>;
  /** Never rejects: the container reports its own failure through `error`. */
  onRegister: (draft: RegisterDraft) => Promise<void>;
}

/**
 * Collecting form: pick the owed concepts (and the explicit extras), see the itemized charge the server
 * computes, choose the method and confirm. Only concept identities are sent, never an amount.
 */
export function PaymentForm({ memberId, account, disciplines, error, onPreview, onRegister }: PaymentFormProps) {
  const owed = account.owed.flatMap((entry) => entry.concepts);
  const [selected, setSelected] = useState(() => new Set(owed.map(conceptKey)));
  const [enrollment, setEnrollment] = useState(false);
  const [carnet, setCarnet] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [preview, setPreview] = useState<Charge | null>(null);
  const [previewError, setPreviewError] = useState<string>();
  // Separate flags: previewing may be cancelled by a change; a registration in flight blocks every change.
  const [previewing, setPreviewing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const latestPreview = useRef(0);

  const concepts: ChargeConcept[] = [
    ...owed.filter((concept) => selected.has(conceptKey(concept))),
    ...(enrollment ? [{ kind: 'enrollment' as const }] : []),
    ...(carnet ? [{ kind: 'carnetReplacement' as const }] : []),
  ];
  // A first-time registration is signalled with an empty object; the server fixes the enrollment date.
  const request: PreviewRequest = { memberId, concepts, ...(enrollment ? { registration: {} } : {}) };

  // Any change to what is being paid invalidates the previewed total, so a stale total can never be confirmed.
  function change(update: () => void) {
    if (registering) return;
    latestPreview.current += 1;
    update();
    setPreview(null);
    setPreviewError(undefined);
    setPreviewing(false);
  }

  function toggleOwed(key: string) {
    change(() => setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    }));
  }

  async function handlePreview() {
    const id = ++latestPreview.current;
    setPreviewing(true);
    setPreviewError(undefined);
    try {
      const charge = await onPreview(request);
      if (id === latestPreview.current) setPreview(charge);
    } catch (caught) {
      if (id === latestPreview.current) setPreviewError(describePaymentError(caught));
    } finally {
      if (id === latestPreview.current) setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!method || !preview || previewing || registering) return;
    setRegistering(true);
    await onRegister({ ...request, method });
    setRegistering(false);
  }

  return (
    <section className="card payments-section" aria-label="Registrar cobro">
      <h2 className="payments-section__title">Registrar cobro</h2>
      {/* While a registration is in flight nothing can change, so the request id stays tied to one selection. */}
      <fieldset className="payments-controls" disabled={registering}>
      {account.owed.length === 0 ? <p className="members-page__notice">No hay conceptos adeudados.</p> : null}
      {account.owed.map((entry) => (
        <fieldset key={entry.period} className="payments-period">
          <legend>Período {formatPeriod(entry.period)}</legend>
          {entry.concepts.map((concept) => (
            <label key={conceptKey(concept)} className="payments-check">
              <input type="checkbox" checked={selected.has(conceptKey(concept))} onChange={() => toggleOwed(conceptKey(concept))} />
              {conceptLabel(concept, disciplines)}
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset className="payments-period">
        <legend>Otros conceptos</legend>
        <label className="payments-check">
          <input type="checkbox" checked={enrollment} onChange={() => change(() => setEnrollment(!enrollment))} />
          Inscripción (socio nuevo)
        </label>
        <label className="payments-check">
          <input type="checkbox" checked={carnet} onChange={() => change(() => setCarnet(!carnet))} />
          Reposición de carnet
        </label>
      </fieldset>

      {previewError ? <p className="form-alert" role="alert">{previewError}</p> : null}
      <div className="member-form__actions">
        <button type="button" className="button button--secondary" disabled={previewing || concepts.length === 0} onClick={handlePreview}>
          {previewing ? 'Calculando…' : 'Calcular total'}
        </button>
      </div>

      {preview ? (
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
              {preview.lines.map((line, index) => (
                // A line has no identity besides its position in the server's answer.
                <tr key={index}>
                  <td>{lineLabel(line, disciplines)}</td>
                  <td>{formatPesos(line.amount)}</td>
                </tr>
              ))}
              <tr className="receipt__total">
                <th scope="row">Total</th>
                <td>{formatPesos(preview.total)}</td>
              </tr>
            </tbody>
          </table>
          <div className="segmented" role="radiogroup" aria-label="Medio de pago">
            {PAYMENT_METHODS.map((option) => (
              <label key={option.value} className="segmented__option">
                <input type="radio" name="payment-method" value={option.value} checked={method === option.value} onChange={() => setMethod(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
      </fieldset>

      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <div className="member-form__actions">
        <button type="button" className="button button--primary" disabled={!preview || !method || previewing || registering} onClick={handleConfirm}>
          {registering ? 'Registrando…' : 'Confirmar cobro'}
        </button>
      </div>
    </section>
  );
}
