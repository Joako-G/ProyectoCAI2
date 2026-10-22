import { useState } from 'react';
import { DisciplineCatalogNotice } from '../../disciplines/components/DisciplineCatalogNotice';
import { catalogDisciplines, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { describeError, useMemberDetail } from '../hooks/useMemberDetail';
import { ApiError, deactivateMember, reactivateMember } from '../services/members-api';
import type { Member } from '../types/member';
import { MemberDetail } from './MemberDetail';
import { DeactivateDialog, ReactivateDialog } from './MemberDialogs';

interface MemberDetailScreenProps {
  id: string;
  today: string;
  /** Discipline catalog used to name the member's disciplines; a failure is reported with a retry. */
  catalog: DisciplineCatalog;
  onBack: () => void;
  onEdit: (id: string) => void;
}

type Dialog = 'deactivate' | 'reactivate' | null;

/** Container: loads the member and runs the deactivate / reactivate actions. */
export function MemberDetailScreen({ id, today, catalog, onBack, onEdit }: MemberDetailScreenProps) {
  const { state, retry, replace } = useMemberDetail(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string>();
  /** Message of an action that failed because the member changed or vanished; survives the refresh. */
  const [staleNotice, setStaleNotice] = useState<string>();

  function closeDialog() {
    setDialog(null);
    setActionError(undefined);
  }

  async function run(action: () => Promise<Member>) {
    setSaving(true);
    setActionError(undefined);
    setStaleNotice(undefined);
    try {
      replace(await action());
      setDialog(null);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        // The member changed or was removed elsewhere: drop the dialog and reload the real state.
        setStaleNotice(error.message);
        setDialog(null);
        retry();
      } else {
        setActionError(describeError(error));
      }
    } finally {
      setSaving(false);
    }
  }

  if (state.phase === 'loading') {
    return (
      <p className="card members-page__notice" role="status">
        Cargando socio…
      </p>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="card members-page__notice members-page__notice--error" role="alert">
        <p>
          <strong>No se pudo cargar el socio.</strong> {state.message}
        </p>
        <div className="member-detail__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setStaleNotice(undefined);
              retry();
            }}
          >
            Reintentar
          </button>
          <button type="button" className="button button--secondary" onClick={onBack}>
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const { member } = state;
  const memberName = `${member.firstName} ${member.lastName}`;

  return (
    <>
      {staleNotice ? (
        <p className="form-alert" role="alert">
          {staleNotice}
        </p>
      ) : null}
      <DisciplineCatalogNotice catalog={catalog} />
      <MemberDetail
        member={member}
        today={today}
        disciplines={catalogDisciplines(catalog)}
        onBack={onBack}
        onEdit={() => onEdit(member.id)}
        onDeactivate={() => setDialog('deactivate')}
        onReactivate={() => setDialog('reactivate')}
      />
      {dialog === 'deactivate' ? (
        <DeactivateDialog
          memberName={memberName}
          saving={saving}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={(reason) => run(() => deactivateMember(member.id, reason))}
        />
      ) : null}
      {dialog === 'reactivate' ? (
        <ReactivateDialog
          memberName={memberName}
          saving={saving}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={() => run(() => reactivateMember(member.id))}
        />
      ) : null}
    </>
  );
}
