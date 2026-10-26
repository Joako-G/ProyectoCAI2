import { useId, useState, type FormEvent } from 'react';
import type { Tariff } from '../types/pricing';
import { formatPeriod } from '../utils/pricing-format';
import { MONEY_FIELDS, validateTariffForm, type TariffFormValues } from '../utils/pricing-validation';

interface TariffFormProps {
  /** `add` asks for the starting month; `edit` keeps the month of `tariff` fixed. */
  tariff?: Tariff;
  /** Current month (`YYYY-MM`): a new tariff cannot start before it. */
  month: string;
  saving: boolean;
  onSubmit: (tariff: Tariff) => void;
  onCancel?: () => void;
}

function initialValues(tariff?: Tariff): TariffFormValues {
  return {
    effectiveFrom: tariff?.effectiveFrom ?? '',
    enrollment: String(tariff?.enrollment ?? ''),
    socialFee: String(tariff?.socialFee ?? ''),
    activityFee: String(tariff?.activityFee ?? ''),
    carnetReplacement: String(tariff?.carnetReplacement ?? ''),
  };
}

/** Presentational add / edit form for one tariff. Validates on submit and reports the tariff through `onSubmit`. */
export function TariffForm({ tariff, month, saving, onSubmit, onCancel }: TariffFormProps) {
  const [values, setValues] = useState<TariffFormValues>(() => initialValues(tariff));
  const [errors, setErrors] = useState<Partial<Record<keyof TariffFormValues, string>>>({});
  const idPrefix = useId();
  const editing = tariff !== undefined;

  function change(name: keyof TariffFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const result = validateTariffForm(values, month);
    setErrors(result.errors);
    if (result.tariff) onSubmit(result.tariff);
  }

  function field(name: keyof TariffFormValues, label: string) {
    const id = `${idPrefix}-${name}`;
    const error = errors[name];
    return (
      <div className="form-field" key={name}>
        <label htmlFor={id} className="form-field__label">{label}</label>
        <input
          id={id}
          type={name === 'effectiveFrom' ? 'month' : 'text'}
          inputMode={name === 'effectiveFrom' ? undefined : 'numeric'}
          autoComplete="off"
          value={values[name]}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => change(name, event.target.value)}
        />
        {error ? <p id={`${id}-error`} className="form-field__error">{error}</p> : null}
      </div>
    );
  }

  return (
    <form className="member-form pricing-form" noValidate onSubmit={handleSubmit}>
      <fieldset className="member-form__section">
        <legend className="member-form__legend">{editing ? `Editar tarifa ${formatPeriod(tariff.effectiveFrom)}` : 'Nueva tarifa'}</legend>
        <div className="member-form__grid">
          {editing ? null : field('effectiveFrom', 'Vigente desde')}
          {MONEY_FIELDS.map(({ name, label }) => field(name, label))}
        </div>
        <div className="member-form__actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar tarifa' : 'Agregar tarifa'}
          </button>
          {onCancel ? <button type="button" className="button button--secondary" disabled={saving} onClick={onCancel}>Cancelar</button> : null}
        </div>
      </fieldset>
    </form>
  );
}
