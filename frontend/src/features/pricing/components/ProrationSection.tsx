import { useId, useState, type FormEvent } from 'react';
import { useSaveAction } from '../hooks/useSaveAction';
import type { ProrationRule } from '../types/pricing';
import { validateProration, type ProrationValues } from '../utils/pricing-validation';
import { SaveFeedback } from './SaveFeedback';

interface ProrationSectionProps {
  rule: ProrationRule;
  canWrite: boolean;
  onSave: (rule: ProrationRule) => Promise<void>;
}

/** Proration of the activity fee for members who join late in the month; the social fee is never reduced. */
export function ProrationSection({ rule, canWrite, onSave }: ProrationSectionProps) {
  const [values, setValues] = useState<ProrationValues>({ afterDay: String(rule.afterDay), activityPercent: String(rule.activityPercent) });
  const [errors, setErrors] = useState<Partial<Record<keyof ProrationValues, string>>>({});
  const save = useSaveAction();
  const idPrefix = useId();

  function change(name: keyof ProrationValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.saving) return;
    const result = validateProration(values);
    setErrors(result.errors);
    if (result.rule) {
      const valid = result.rule;
      await save.run(() => onSave(valid), 'Prorrateo guardado.');
    }
  }

  function field(name: keyof ProrationValues, label: string) {
    const id = `${idPrefix}-${name}`;
    const error = errors[name];
    return (
      <div className="form-field">
        <label htmlFor={id} className="form-field__label">{label}</label>
        <input id={id} type="text" inputMode="numeric" autoComplete="off" value={values[name]} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => change(name, event.target.value)} />
        {error ? <p id={`${id}-error`} className="form-field__error">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="card pricing-section" aria-labelledby="pricing-proration-title">
      <h2 id="pricing-proration-title" className="pricing-section__title">Prorrateo para socios nuevos</h2>
      <p className="member-form__hint">
        Un socio nuevo que ingresa después del día indicado paga solo ese porcentaje de cada cuota por actividad.
        La cuota social nunca se descuenta.
      </p>
      {canWrite ? (
        <form className="member-form" noValidate onSubmit={handleSubmit}>
          <div className="member-form__grid">
            {field('afterDay', 'Día a partir del cual se prorratea')}
            {field('activityPercent', 'Porcentaje de la cuota por actividad')}
          </div>
          <SaveFeedback error={save.error} notice={save.notice} />
          <div className="member-form__actions">
            <button type="submit" className="button button--primary" disabled={save.saving}>{save.saving ? 'Guardando…' : 'Guardar prorrateo'}</button>
          </div>
        </form>
      ) : (
        <p>Después del día {rule.afterDay} se cobra el {rule.activityPercent} % de la cuota por actividad.</p>
      )}
    </section>
  );
}
