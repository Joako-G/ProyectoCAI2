import { useId } from 'react';
import { hasMoneySeparator, MONEY_INPUT_MAX_LENGTH, MONEY_SEPARATOR_MESSAGE, moneyChars } from '../../utils/input-limits';

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
 * A whole-peso amount. It stops at ten digits, so it can never be filled without bound, and it echoes the
 * amount formatted so a misplaced zero is easy to see. A comma or a lone dot stays in the field and is flagged
 * instead of being dropped, because dropping it would silently multiply the amount by a hundred.
 */
export function MoneyField({ label, value, disabled = false, error: externalError, onChange }: MoneyFieldProps) {
  const id = useId();
  const error = hasMoneySeparator(value) ? MONEY_SEPARATOR_MESSAGE : externalError;
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
        maxLength={MONEY_INPUT_MAX_LENGTH}
        placeholder="0"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : value ? hintId : undefined}
        onChange={(event) => onChange(moneyChars(event.target.value))}
      />
      {error ? (
        <p id={errorId} className="desk-field__error">{error}</p>
      ) : value ? (
        <p id={hintId} className="desk-field__hint">$ {pesos.format(Number(value))}</p>
      ) : null}
    </div>
  );
}
