import { useState } from 'react';
import { formatPesos } from '../../pricing/utils/pricing-format';
import type { CloseDayInput } from '../types/cashcount';
import { describeVariance, parseCountedCash } from '../utils/cashcount-format';

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
    <form className="report-filters" onSubmit={(event) => { event.preventDefault(); if (amount !== null) setConfirming(true); }}>
      <div className="form-field">
        <label htmlFor="arqueo-counted" className="form-field__label">Efectivo contado</label>
        <input id="arqueo-counted" type="text" inputMode="numeric" autoComplete="off" value={counted} disabled={confirming || saving}
          onChange={(event) => setCounted(event.target.value)} />
      </div>

      {variance !== null ? (
        <p className="report-result__total"><span>Diferencia</span> <strong data-testid="variance">{describeVariance(variance)}</strong></p>
      ) : null}

      {variance !== null && variance !== 0 ? (
        <div className="form-field">
          <label htmlFor="arqueo-note" className="form-field__label">Motivo de la diferencia (opcional)</label>
          <textarea id="arqueo-note" rows={2} maxLength={500} value={note} disabled={confirming || saving} onChange={(event) => setNote(event.target.value)} />
        </div>
      ) : null}

      {error ? <p className="form-field__error" role="alert">{error}</p> : null}

      {confirming && amount !== null ? (
        <div className="members-page__notice" role="alertdialog" aria-label="Confirmar cierre">
          <p>El cierre no se puede modificar después. ¿Cerrar el día con {formatPesos(amount)} contados?</p>
          <button type="button" className="button button--primary" onClick={confirm}>Confirmar cierre</button>
          <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="submit" className="button button--primary" disabled={amount === null || saving}>Cerrar el día</button>
      )}
    </form>
  );
}
