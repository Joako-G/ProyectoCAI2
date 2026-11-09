import { useId } from 'react';
import { digitsOnly, MAX_MONEY_DIGITS } from '../../utils/input-limits';

interface MoneyFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  /** Shown under the field and tied to it for screen readers while it is set. */
  error?: string;
  onChange: (value: string) => void;
}

const pesos = new Intl.NumberFormat('es-AR');

/**
 * A whole-peso amount. It accepts digits only and stops at ten of them, so it can never be filled without bound,
 * and it echoes the amount formatted so a misplaced zero is easy to see.
 */
export function MoneyField({ label, value, disabled = false, error, onChange }: MoneyFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-field__label">{label}</label>
      <input
        id={id}
        className="desk-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={MAX_MONEY_DIGITS}
        placeholder="0"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : value ? hintId : undefined}
        onChange={(event) => onChange(digitsOnly(event.target.value, MAX_MONEY_DIGITS))}
      />
      {error ? (
        <p id={errorId} className="desk-field__error">{error}</p>
      ) : value ? (
        <p id={hintId} className="desk-field__hint">$ {pesos.format(Number(value))}</p>
      ) : null}
    </div>
  );
}
