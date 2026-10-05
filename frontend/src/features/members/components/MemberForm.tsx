import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { MEMBER_CATEGORIES, type MemberInput } from '../types/member';
import {
  isMinorOn,
  validateMemberForm,
  type FieldErrors,
  type MemberFormValues,
} from '../utils/member-validation';

interface MemberFormProps {
  mode: 'create' | 'edit';
  initialValues: MemberFormValues;
  /** Today's club date (`YYYY-MM-DD`): bounds the date fields and decides who is a minor. */
  today: string;
  saving: boolean;
  /** Errors reported by the backend, keyed like the form errors (`guardian.name`, ...). */
  fieldErrors?: FieldErrors;
  /** General error that does not belong to a single field. */
  submitError?: string;
  onSubmit: (input: MemberInput) => void;
  onCancel: () => void;
}

// Guardian inputs use the backend's dotted names so errors map 1:1; their state keys are flat.
const VALUE_KEY_BY_FIELD: Record<string, keyof MemberFormValues> = {
  'guardian.name': 'guardianName',
  'guardian.contact': 'guardianContact',
};

interface FieldProps {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  children: (props: {
    id: string;
    name: string;
    required: boolean;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

function Field({ name, label, required = true, error, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      {children({
        id,
        name,
        required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} className="form-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Presentational create/edit form. Validates on submit and reports the payload through `onSubmit`. */
export function MemberForm({
  mode,
  initialValues,
  today,
  saving,
  fieldErrors,
  submitError,
  onSubmit,
  onCancel,
}: MemberFormProps) {
  const [values, setValues] = useState<MemberFormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      setErrors((current) => ({ ...current, ...fieldErrors }));
      setFocusRequest((current) => current + 1);
    }
  }, [fieldErrors]);

  useEffect(() => {
    if (focusRequest > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const isMinor = isMinorOn(values.birthDate, today);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [VALUE_KEY_BY_FIELD[name] ?? name]: value }));
    setErrors((current) => {
      if (!(name in current)) return current;
      const { [name]: _cleared, ...rest } = current;
      return rest;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const result = validateMemberForm(values, today);
    setErrors(result.errors);
    if (result.input) onSubmit(result.input);
    else setFocusRequest((current) => current + 1);
  }

  const text = (name: keyof MemberFormValues, fieldName: string = name) => ({
    value: values[name],
    onChange: handleChange,
    name: fieldName,
  });

  return (
    <form ref={formRef} className="member-form" noValidate onSubmit={handleSubmit}>
      {submitError ? (
        <p className="form-alert" role="alert">
          {submitError}
        </p>
      ) : null}

      <fieldset className="member-form__section">
        <legend className="member-form__legend">Datos personales</legend>
        <div className="member-form__grid">
          <Field name="firstName" label="Nombre" error={errors.firstName}>
            {(props) => <input type="text" autoComplete="off" {...props} {...text('firstName')} />}
          </Field>
          <Field name="lastName" label="Apellido" error={errors.lastName}>
            {(props) => <input type="text" autoComplete="off" {...props} {...text('lastName')} />}
          </Field>
          <Field name="dni" label="DNI" error={errors.dni}>
            {(props) => <input type="text" inputMode="numeric" autoComplete="off" {...props} {...text('dni')} />}
          </Field>
          <Field name="birthDate" label="Fecha de nacimiento" error={errors.birthDate}>
            {(props) => <input type="date" max={today} {...props} {...text('birthDate')} />}
          </Field>
          <Field name="category" label="Categoría" error={errors.category}>
            {(props) => (
              <select {...props} value={values.category} onChange={handleChange}>
                <option value="">Elegir categoría</option>
                {MEMBER_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field name="memberSince" label="Socio desde" error={errors.memberSince}>
            {(props) => <input type="date" max={today} {...props} {...text('memberSince')} />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="member-form__section">
        <legend className="member-form__legend">Contacto</legend>
        <div className="member-form__grid">
          <Field name="whatsapp" label="WhatsApp" error={errors.whatsapp}>
            {(props) => <input type="tel" autoComplete="off" {...props} {...text('whatsapp')} />}
          </Field>
          <Field name="email" label="Email (opcional)" required={false} error={errors.email}>
            {(props) => <input type="email" autoComplete="off" {...props} {...text('email')} />}
          </Field>
        </div>
      </fieldset>

      {isMinor ? (
        <fieldset className="member-form__section">
          <legend className="member-form__legend">Tutor o responsable</legend>
          <p className="member-form__hint">El socio es menor de 18 años: el tutor es obligatorio.</p>
          <div className="member-form__grid">
            <Field name="guardian.name" label="Nombre del tutor" error={errors['guardian.name']}>
              {(props) => <input type="text" autoComplete="off" {...props} {...text('guardianName', 'guardian.name')} />}
            </Field>
            <Field name="guardian.contact" label="Contacto del tutor" error={errors['guardian.contact']}>
              {(props) => <input type="tel" autoComplete="off" {...props} {...text('guardianContact', 'guardian.contact')} />}
            </Field>
          </div>
        </fieldset>
      ) : null}

      <div className="member-form__actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Guardando…' : mode === 'create' ? 'Crear socio' : 'Guardar cambios'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
