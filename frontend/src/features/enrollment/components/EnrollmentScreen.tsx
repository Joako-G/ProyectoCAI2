import { useRef, useState } from 'react';
import { catalogDisciplines, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { MemberForm } from '../../members/components/MemberForm';
import { describeError } from '../../members/hooks/useMemberDetail';
import { ApiError, createMember, fetchMembers } from '../../members/services/members-api';
import type { Member } from '../../members/types/member';
import { emptyMemberForm, validateMemberForm, type FieldErrors, type MemberFormValues } from '../../members/utils/member-validation';
import { registerPayment } from '../../payments/services/payments-api';
import type { Charge, ChargeConcept, PaymentMethod } from '../../payments/types/payment';
import { describePaymentError, newRequestId } from '../../payments/utils/payment-format';
import { EnrollmentPaymentStep } from './EnrollmentPaymentStep';

interface EnrollmentScreenProps {
  today: string;
  /** Discipline catalog shared by the members screens. */
  catalog: DisciplineCatalog;
  /** Called with the new member once it is saved and its enrollment collected. */
  onSaved: (member: Member) => void;
  onCancel: () => void;
}

type Step = 'data' | 'disciplines' | 'payment';

const STEP_TITLE: Record<Step, string> = {
  data: 'Paso 1 de 3 · Datos',
  disciplines: 'Paso 2 de 3 · Disciplinas',
  payment: 'Paso 3 de 3 · Cobro',
};

const DUPLICATE_DNI = 'Ya existe un socio con ese DNI.';

interface DataFailure {
  fieldErrors: FieldErrors;
  message?: string;
}

// The server priced these lines, so the payment names exactly them; surcharge lines are derived, not requested.
function conceptsFrom(charge: Charge): ChargeConcept[] {
  return charge.lines.flatMap((line): ChargeConcept[] => {
    if (line.kind === 'enrollment') return [{ kind: 'enrollment' }];
    if (line.kind === 'socialFee') return [{ kind: 'socialFee', period: line.period }];
    if (line.kind === 'activityFee') return [{ kind: 'activityFee', period: line.period, disciplineId: line.disciplineId ?? '' }];
    return [];
  });
}

/**
 * Container of the member enrollment: data, disciplines and collection in three steps. Everything the
 * secretary entered is kept in one draft, so going back never loses it. Nothing is saved until the last
 * step: the member is created first (its memberships follow from its disciplines) and then collected.
 */
export function EnrollmentScreen({ today, catalog, onSaved, onCancel }: EnrollmentScreenProps) {
  const [step, setStep] = useState<Step>('data');
  const [draft, setDraft] = useState<MemberFormValues>(() => emptyMemberForm(today));
  const [dataFailure, setDataFailure] = useState<DataFailure>();
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Member>();
  const [paymentError, setPaymentError] = useState<string>();
  // One key for the collection of this enrollment: a retry after a failure can never charge twice.
  const requestId = useRef(newRequestId());

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
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const disciplines = catalogDisciplines(catalog);

  // The DNI is checked here, before any money is taken; the server checks it again when the member is created.
  async function continueFromData(values: MemberFormValues) {
    setDraft(values);
    setDataFailure(undefined);
    setChecking(true);
    try {
      const dni = values.dni.replace(/[.\s]/g, '');
      const found = await fetchMembers({ search: dni, status: 'all' });
      if (found.some((member) => member.dni === dni)) {
        setDataFailure({ fieldErrors: { dni: DUPLICATE_DNI } });
        return;
      }
    } catch {
      // Could not check: the creation below reports a duplicate before anything is collected.
    } finally {
      setChecking(false);
    }
    setStep('disciplines');
  }

  async function confirm(method: PaymentMethod, charge: Charge) {
    const input = validateMemberForm(draft, today).input;
    if (!input) {
      setStep('data');
      return;
    }
    setSaving(true);
    setPaymentError(undefined);
    let member = saved;
    if (!member) {
      try {
        member = await createMember(input);
        setSaved(member);
      } catch (error) {
        setSaving(false);
        if (error instanceof ApiError && error.status === 409) {
          setDataFailure({ fieldErrors: { dni: DUPLICATE_DNI }, message: `No se pudo guardar. ${DUPLICATE_DNI}` });
          setStep('data');
        } else if (error instanceof ApiError && error.code === 'validation_error') {
          setDataFailure({ fieldErrors: error.fieldErrors, message: 'Revisá los datos ingresados.' });
          setStep('data');
        } else {
          setPaymentError(describeError(error));
        }
        return;
      }
    }
    try {
      await registerPayment({ memberId: member.id, concepts: conceptsFrom(charge), registration: {}, method, requestId: requestId.current });
      onSaved(member);
    } catch (error) {
      setPaymentError(describePaymentError(error));
      setSaving(false);
    }
  }

  return (
    <section className="card member-form-card" aria-label="Alta de socio">
      <h2 className="member-form__title">Alta de socio</h2>
      <p className="member-form__hint">{STEP_TITLE[step]}</p>

      {step === 'data' ? (
        <MemberForm
          key="data"
          mode="create"
          initialValues={draft}
          today={today}
          disciplines={disciplines}
          saving={checking}
          fieldErrors={dataFailure?.fieldErrors}
          submitError={dataFailure?.message}
          sections={['data']}
          submitLabel="Continuar"
          onContinue={continueFromData}
          onSubmit={() => undefined}
          onCancel={onCancel}
        />
      ) : null}

      {step === 'disciplines' ? (
        <MemberForm
          key="disciplines"
          mode="create"
          initialValues={draft}
          today={today}
          disciplines={disciplines}
          saving={false}
          sections={['disciplines']}
          submitLabel="Continuar"
          onContinue={(values) => {
            setDraft(values);
            setStep('payment');
          }}
          onBack={(values) => {
            setDraft(values);
            setStep('data');
          }}
          onSubmit={() => undefined}
          onCancel={onCancel}
        />
      ) : null}

      {step === 'payment' ? (
        <EnrollmentPaymentStep
          disciplineIds={draft.disciplineIds}
          disciplines={disciplines}
          memberName={`${draft.firstName.trim()} ${draft.lastName.trim()}`}
          saving={saving}
          savedMember={saved}
          error={paymentError}
          onBack={() => setStep('disciplines')}
          onCancel={onCancel}
          onConfirm={confirm}
          onSkip={() => saved && onSaved(saved)}
        />
      ) : null}
    </section>
  );
}
