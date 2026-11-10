import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { FieldErrors } from '../../members/utils/member-validation';
import type { DisciplineInput, TeacherOption } from '../types/discipline';
import { validateDisciplineForm, type DisciplineFormValues } from '../utils/discipline-validation';

interface DisciplineFormProps {
  mode: 'create' | 'edit';
  initialValues: DisciplineFormValues;
  /** The teacher accounts that can be put on the discipline. */
  teacherOptions: TeacherOption[];
  /** Names typed in before teachers were accounts; shown so the matching accounts can be picked. */
  legacyTeachers?: string[];
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
        placeholder="Por ejemplo: Vóley"
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
  teacherOptions,
  legacyTeachers = [],
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

  // The first teacher picked is in charge; when the one in charge is taken off, the first one left takes over.
  function toggleTeacher(id: string) {
    setValues((current) => {
      const teacherIds = current.teacherIds.includes(id) ? current.teacherIds.filter((other) => other !== id) : [...current.teacherIds, id];
      return { ...current, teacherIds, leadId: teacherIds.includes(current.leadId) ? current.leadId : (teacherIds[0] ?? '') };
    });
    clearErrors('teachers', 'leadTeacher');
  }

  function selectLead(id: string) {
    setValues((current) => ({ ...current, leadId: id }));
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

  const chosen = values.teacherIds.length;
  const firstChosen = teacherOptions.find(({ id }) => values.teacherIds.includes(id))?.id;

  return (
    <form ref={formRef} className="member-form" noValidate onSubmit={handleSubmit}>
      {submitError ? (
        <p className="form-alert" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="discipline-form__step">
        <p className="discipline-form__step-title"><span className="discipline-form__step-number" aria-hidden="true">1</span>Datos de la disciplina</p>
        <NameField value={values.name} error={errors.name} onChange={handleNameChange} />
      </div>

      <fieldset className="discipline-form__step discipline-form__teachers" aria-describedby={errors.teachers ? teachersErrorId : undefined}>
        <legend className="discipline-form__step-title"><span className="discipline-form__step-number" aria-hidden="true">2</span>Profesores</legend>
        <p className="member-form__hint">Marcá los profesores que dan esta disciplina y elegí cuál está a cargo. La lista muestra los usuarios con rol profesor.</p>
        {legacyTeachers.length > 0 ? (
          <p className="discipline-form__legacy">
            Antes figuraban: <strong>{legacyTeachers.join(', ')}</strong>. Marcá sus usuarios en la lista; al guardar, reemplazan a esos nombres.
          </p>
        ) : null}
        {teacherOptions.length === 0 ? (
          <p className="members-page__notice">Todavía no hay usuarios con rol profesor. Creá uno desde la sección Usuarios y volvé a esta pantalla.</p>
        ) : (
          <>
            {teacherOptions.map((teacher, index) => {
              const checked = values.teacherIds.includes(teacher.id);
              return (
                <div key={teacher.id} className="teacher-row" data-checked={checked} data-lead={values.leadId === teacher.id}>
                  <label className="teacher-row__pick">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-invalid={errors.teachers && index === 0 ? true : undefined}
                      aria-describedby={errors.teachers ? teachersErrorId : undefined}
                      onChange={() => toggleTeacher(teacher.id)}
                    />
                    <span>{teacher.name}</span>
                  </label>
                  <label className="teacher-row__lead" data-disabled={!checked}>
                    <input
                      type="radio"
                      name={leadGroupName}
                      checked={values.leadId === teacher.id}
                      disabled={!checked}
                      aria-label={`A cargo: ${teacher.name}`}
                      aria-invalid={errors.leadTeacher && teacher.id === firstChosen ? true : undefined}
                      aria-describedby={errors.leadTeacher ? leadErrorId : undefined}
                      onChange={() => selectLead(teacher.id)}
                    />
                    <span aria-hidden="true">A cargo</span>
                  </label>
                </div>
              );
            })}
            <p className="discipline-form__count" role="status">
              {chosen === 0 ? 'Ningún profesor elegido' : chosen === 1 ? '1 profesor elegido' : `${chosen} profesores elegidos`}
            </p>
          </>
        )}
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
      </fieldset>

      <div className="member-form__actions discipline-form__actions">
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
