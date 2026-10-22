import { useEffect, useRef, useState } from 'react';
import { catalogDisciplines, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { describeError, useMemberDetail } from '../hooks/useMemberDetail';
import { ApiError, createMember, updateMember } from '../services/members-api';
import type { Member, MemberInput } from '../types/member';
import { emptyMemberForm, memberToFormValues, type FieldErrors } from '../utils/member-validation';
import { MemberForm } from './MemberForm';

interface MemberFormScreenProps {
  /** `null` creates a new member; an id edits that member. */
  memberId: string | null;
  today: string;
  /** Discipline catalog shared by the members screens; the form waits until it is loaded. */
  catalog: DisciplineCatalog;
  onSaved: (member: Member) => void;
  onCancel: () => void;
}

const DUPLICATE_DNI = 'Ya existe un socio con ese DNI.';

interface SaveFailure {
  fieldErrors: FieldErrors;
  message: string;
}

function toSaveFailure(error: unknown): SaveFailure {
  if (error instanceof ApiError && error.status === 409) {
    return { fieldErrors: { dni: DUPLICATE_DNI }, message: `No se pudo guardar. ${DUPLICATE_DNI}` };
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
export function MemberFormScreen({ memberId, today, catalog, onSaved, onCancel }: MemberFormScreenProps) {
  const editing = memberId !== null;
  const { state, retry } = useMemberDetail(memberId);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<SaveFailure>();

  async function save(input: MemberInput) {
    setSaving(true);
    setFailure(undefined);
    try {
      onSaved(editing ? await updateMember(memberId, input) : await createMember(input));
    } catch (error) {
      setFailure(toSaveFailure(error));
      setSaving(false);
    }
  }

  const title = editing ? 'Editar socio' : 'Alta de socio';

  if (editing && state.phase !== 'ready') {
    return state.phase === 'loading' ? (
      <p className="card members-page__notice" role="status">
        Cargando socio…
      </p>
    ) : (
      <div className="card members-page__notice members-page__notice--error" role="alert">
        <p>
          <strong>No se pudo cargar el socio.</strong> {state.message}
        </p>
        <div className="member-detail__actions">
          <button type="button" className="button button--secondary" onClick={retry}>
            Reintentar
          </button>
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (catalog.state.phase !== 'ready') {
    return catalog.state.phase === 'loading' ? (
      <p className="card members-page__notice" role="status">
        Cargando disciplinas…
      </p>
    ) : (
      <div className="card members-page__notice members-page__notice--error" role="alert">
        <p>
          <strong>No se pudieron cargar las disciplinas.</strong> {catalog.state.message}
        </p>
        <div className="member-detail__actions">
          <button type="button" className="button button--secondary" onClick={catalog.retry}>
            Reintentar
          </button>
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="card member-form-card" aria-label={title}>
      <FormHeading>{title}</FormHeading>
      <MemberForm
        mode={editing ? 'edit' : 'create'}
        initialValues={state.phase === 'ready' ? memberToFormValues(state.member) : emptyMemberForm(today)}
        today={today}
        disciplines={catalogDisciplines(catalog)}
        saving={saving}
        fieldErrors={failure?.fieldErrors}
        submitError={failure?.message}
        onSubmit={save}
        onCancel={onCancel}
      />
    </section>
  );
}
