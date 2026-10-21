import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { FieldErrors } from '../../members/utils/member-validation';
import type { DisciplineInput } from '../types/discipline';
import { validateDisciplineForm, type DisciplineFormValues } from '../utils/discipline-validation';

interface DisciplineFormProps {
  mode: 'create' | 'edit';
  initialValues: DisciplineFormValues;
  saving: boolean;
  /** Errors reported by the backend, keyed like the form fields. */
  fieldErrors?: FieldErrors;
  /** General error that does not belong to a single field. */
  submitError?: string;
  onSubmit: (input: DisciplineInput) => void;
  onCancel: () => void;
}

interface TextFieldProps {
  name: keyof DisciplineFormValues;
  label: string;
  value: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function TextField({ name, label, value, error, onChange }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        required
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={onChange}
      />
      {error ? (
        <p id={errorId} className="form-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Presentational create/edit form. Validates on submit and reports the payload through `onSubmit`. */
export function DisciplineForm({
  mode,
  initialValues,
  saving,
  fieldErrors,
  submitError,
  onSubmit,
  onCancel,
}: DisciplineFormProps) {
  const [values, setValues] = useState<DisciplineFormValues>(initialValues);
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

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!(name in current)) return current;
      const { [name]: _cleared, ...rest } = current;
      return rest;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const result = validateDisciplineForm(values);
    setErrors(result.errors);
    if (result.input) onSubmit(result.input);
    else setFocusRequest((current) => current + 1);
  }

  return (
    <form ref={formRef} className="member-form" noValidate onSubmit={handleSubmit}>
      {submitError ? (
        <p className="form-alert" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="member-form__grid">
        <TextField
          name="name"
          label="Nombre"
          value={values.name}
          error={errors.name}
          onChange={handleChange}
        />
        <TextField
          name="teacherName"
          label="Profesor"
          value={values.teacherName}
          error={errors.teacherName}
          onChange={handleChange}
        />
      </div>

      <div className="member-form__actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Guardando…' : mode === 'create' ? 'Crear disciplina' : 'Guardar cambios'}
        </button>
        <button type="button" className="button button--secondary" disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
