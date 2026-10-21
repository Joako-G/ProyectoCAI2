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

interface NameFieldProps {
  value: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function NameField({ value, error, onChange }: NameFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        Nombre
      </label>
      <input
        id={id}
        name="name"
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
  // A new object per request, so asking for the same row twice still moves the focus.
  const [teacherFocus, setTeacherFocus] = useState<{ index: number }>();
  const formRef = useRef<HTMLFormElement>(null);
  const leadGroupName = useId();
  const teachersErrorId = useId();
  const leadErrorId = useId();

  useEffect(() => {
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      setErrors((current) => ({ ...current, ...fieldErrors }));
      setFocusRequest((current) => current + 1);
    }
  }, [fieldErrors]);

  useEffect(() => {
    if (focusRequest > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (teacherFocus) {
      formRef.current?.querySelector<HTMLElement>(`[data-teacher-row="${teacherFocus.index}"]`)?.focus();
    }
  }, [teacherFocus]);

  function clearErrors(...names: string[]) {
    setErrors((current) => {
      if (!names.some((name) => name in current)) return current;
      const rest = { ...current };
      for (const name of names) delete rest[name];
      return rest;
    });
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setValues((current) => ({ ...current, name: event.target.value }));
    clearErrors('name');
  }

  function changeTeacher(index: number, value: string) {
    setValues((current) => ({
      ...current,
      teachers: current.teachers.map((teacher, i) => (i === index ? value : teacher)),
    }));
    clearErrors('teachers');
  }

  function addTeacher() {
    setValues((current) => ({ ...current, teachers: [...current.teachers, ''] }));
    setTeacherFocus({ index: values.teachers.length });
    clearErrors('teachers');
  }

  // The lead follows the same person when a row above it goes away; if the lead row is removed, row 1 takes over.
  function removeTeacher(index: number) {
    if (values.teachers.length <= 1) return;
    setValues((current) => ({
      ...current,
      teachers: current.teachers.filter((_, i) => i !== index),
      leadIndex:
        current.leadIndex === index ? 0 : current.leadIndex > index ? current.leadIndex - 1 : current.leadIndex,
    }));
    setTeacherFocus({ index: Math.max(0, index - 1) });
    clearErrors('teachers', 'leadTeacher');
  }

  function selectLead(index: number) {
    setValues((current) => ({ ...current, leadIndex: index }));
    clearErrors('leadTeacher');
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
        <NameField value={values.name} error={errors.name} onChange={handleNameChange} />
      </div>

      <fieldset className="member-form__section" aria-describedby={errors.teachers ? teachersErrorId : undefined}>
        <legend className="member-form__legend">Profesores</legend>
        {values.teachers.map((teacher, index) => (
          // Rows have no identity besides their position, so the index is the key.
          <div key={index} className="teacher-row">
            <input
              type="text"
              autoComplete="off"
              data-teacher-row={index}
              aria-label={`Profesor ${index + 1}`}
              value={teacher}
              aria-invalid={errors.teachers ? true : undefined}
              aria-describedby={errors.teachers ? teachersErrorId : undefined}
              onChange={(event) => changeTeacher(index, event.target.value)}
            />
            <label className="teacher-row__lead">
              <input
                type="radio"
                name={leadGroupName}
                checked={values.leadIndex === index}
                aria-label={`A cargo: profesor ${index + 1}`}
                aria-invalid={errors.leadTeacher && index === 0 ? true : undefined}
                aria-describedby={errors.leadTeacher ? leadErrorId : undefined}
                onChange={() => selectLead(index)}
              />
              <span aria-hidden="true">A cargo</span>
            </label>
            <button
              type="button"
              className="button button--secondary"
              aria-label={`Quitar profesor ${index + 1}`}
              disabled={values.teachers.length === 1}
              onClick={() => removeTeacher(index)}
            >
              Quitar
            </button>
          </div>
        ))}
        {errors.teachers ? (
          <p id={teachersErrorId} className="form-field__error">
            {errors.teachers}
          </p>
        ) : null}
        {errors.leadTeacher ? (
          <p id={leadErrorId} className="form-field__error">
            {errors.leadTeacher}
          </p>
        ) : null}
        <button type="button" className="button button--secondary" onClick={addTeacher}>
          Agregar profesor
        </button>
      </fieldset>

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
