import { useEffect, useRef, useState } from 'react';
import { describeError } from '../hooks/useDisciplinesList';
import { ApiError, createDiscipline, updateDiscipline } from '../services/disciplines-api';
import type { Discipline, DisciplineInput } from '../types/discipline';
import {
  disciplineToFormValues,
  emptyDisciplineForm,
} from '../utils/discipline-validation';
import type { FieldErrors } from '../../members/utils/member-validation';
import { DisciplineForm } from './DisciplineForm';

interface DisciplineFormScreenProps {
  /** `null` creates a new discipline; a discipline edits that one. */
  discipline: Discipline | null;
  onSaved: () => void;
  onCancel: () => void;
}

const DUPLICATE_NAME = 'Ya existe una disciplina con ese nombre.';

interface SaveFailure {
  fieldErrors: FieldErrors;
  message: string;
}

function toSaveFailure(error: unknown): SaveFailure {
  if (error instanceof ApiError && error.status === 409) {
    return { fieldErrors: { name: DUPLICATE_NAME }, message: `No se pudo guardar. ${DUPLICATE_NAME}` };
  }
  if (error instanceof ApiError && error.code === 'validation_error') {
    return { fieldErrors: error.fieldErrors, message: 'Revisá los datos ingresados.' };
  }
  return { fieldErrors: {}, message: describeError(error) };
}

function FormHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="member-form__title">
      {children}
    </h2>
  );
}

/** Container: owns the request for the shared create / edit form. */
export function DisciplineFormScreen({ discipline, onSaved, onCancel }: DisciplineFormScreenProps) {
  const editing = discipline !== null;
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<SaveFailure>();

  async function save(input: DisciplineInput) {
    setSaving(true);
    setFailure(undefined);
    try {
      await (editing ? updateDiscipline(discipline.id, input) : createDiscipline(input));
      onSaved();
    } catch (error) {
      setFailure(toSaveFailure(error));
      setSaving(false);
    }
  }

  const title = editing ? 'Editar disciplina' : 'Alta de disciplina';

  return (
    <section className="card member-form-card" aria-label={title}>
      <FormHeading>{title}</FormHeading>
      <DisciplineForm
        mode={editing ? 'edit' : 'create'}
        initialValues={editing ? disciplineToFormValues(discipline) : emptyDisciplineForm()}
        saving={saving}
        fieldErrors={failure?.fieldErrors}
        submitError={failure?.message}
        onSubmit={save}
        onCancel={onCancel}
      />
    </section>
  );
}
