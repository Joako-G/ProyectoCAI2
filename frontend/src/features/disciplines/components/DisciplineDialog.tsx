import { ModalDialog } from '../../members/components/ModalDialog';

interface DisciplineStatusDialogProps {
  action: 'deactivate' | 'reactivate';
  disciplineName: string;
  saving: boolean;
  /** Error from the last attempt (shown inside the dialog). */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const COPY = {
  deactivate: {
    title: 'Dar de baja',
    description: 'La disciplina no se elimina: queda inactiva y se puede reactivar.',
    confirm: 'Confirmar baja',
    busy: 'Dando de baja…',
    tone: 'danger',
  },
  reactivate: {
    title: 'Reactivar',
    description: 'La disciplina vuelve a estar activa y se quita la fecha de baja anterior.',
    confirm: 'Confirmar reactivación',
    busy: 'Reactivando…',
    tone: 'primary',
  },
} as const;

/** Confirmation before deactivating or reactivating a discipline (focus handling lives in `ModalDialog`). */
export function DisciplineStatusDialog({
  action,
  disciplineName,
  saving,
  error,
  onConfirm,
  onCancel,
}: DisciplineStatusDialogProps) {
  const copy = COPY[action];

  return (
    <ModalDialog
      role="alertdialog"
      title={`${copy.title} ${disciplineName}`}
      description={copy.description}
      busy={saving}
      onClose={onCancel}
    >
      {error ? (
        <p className="form-alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="modal__actions">
        <button type="button" className={`button button--${copy.tone}`} disabled={saving} onClick={onConfirm}>
          {saving ? copy.busy : copy.confirm}
        </button>
        <button type="button" className="button button--secondary" disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </ModalDialog>
  );
}
