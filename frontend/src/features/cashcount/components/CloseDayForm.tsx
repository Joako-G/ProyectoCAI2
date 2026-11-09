import { useState } from 'react';
import { MoneyField } from '../../../components/desk/MoneyField';
import { formatPesos } from '../../pricing/utils/pricing-format';
import type { CloseDayInput } from '../types/cashcount';
import { describeVariance, parseCountedCash, varianceTone } from '../utils/cashcount-format';

const MAX_NOTE_LENGTH = 500;

interface CloseDayFormProps {
  expectedCash: number;
  saving: boolean;
  error?: string;
  onClose: (input: CloseDayInput) => void;
}

/** The counted cash, the live difference, an optional reason and a confirmation step before the irreversible close. */
export function CloseDayForm({ expectedCash, saving, error, onClose }: CloseDayFormProps) {
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const amount = parseCountedCash(counted);
  const variance = amount === null ? null : amount - expectedCash;

  function confirm() {
    if (amount === null) return;
    const reason = note.trim();
    onClose({ countedCash: amount, ...(variance !== 0 && reason ? { varianceNote: reason } : {}) });
    setConfirming(false);
  }

  return (
    <form className="desk-form" onSubmit={(event) => { event.preventDefault(); if (amount !== null) setConfirming(true); }}>
      <MoneyField label="Efectivo contado" value={counted} disabled={confirming || saving} onChange={setCounted} />

      {variance !== null ? (
        <p className={`desk-verdict desk-verdict--${varianceTone(variance)}`}>
          <span>Diferencia</span> <strong data-testid="variance">{describeVariance(variance)}</strong>
        </p>
      ) : null}

      {variance !== null && variance !== 0 ? (
        <div className="desk-field">
          <label htmlFor="arqueo-note" className="desk-field__label">Motivo de la diferencia (opcional)</label>
          <textarea id="arqueo-note" className="desk-input" rows={3} maxLength={MAX_NOTE_LENGTH} value={note} disabled={confirming || saving}
            onChange={(event) => setNote(event.target.value)} />
          <p className="desk-field__count" aria-hidden="true">{note.length}/{MAX_NOTE_LENGTH}</p>
        </div>
      ) : null}

      {error ? <p className="desk-field__error" role="alert">{error}</p> : null}

      {confirming && amount !== null ? (
        <div className="desk-confirm" role="alertdialog" aria-label="Confirmar cierre">
          <p>El cierre no se puede modificar después. ¿Cerrar el día con {formatPesos(amount)} contados?</p>
          <button type="button" className="desk-primary" onClick={confirm}>Confirmar cierre</button>
          <button type="button" className="desk-secondary" onClick={() => setConfirming(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="submit" className="desk-primary" disabled={amount === null || saving}>Cerrar el día</button>
      )}
    </form>
  );
}
