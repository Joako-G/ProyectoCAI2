import { useId, useRef, useState, type FormEvent } from 'react';
import { ModalDialog } from './ModalDialog';

interface DialogProps {
  memberName: string;
  saving: boolean;
  /** Error from the last attempt (shown inside the dialog). */
  error?: string;
  onCancel: () => void;
}

interface DeactivateDialogProps extends DialogProps {
  onConfirm: (reason: string) => void;
}

interface ReactivateDialogProps extends DialogProps {
  onConfirm: () => void;
}

/** Asks for the deactivation reason (required) before confirming the logical removal. */
export function DeactivateDialog({ memberName, saving, error, onConfirm, onCancel }: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Ingresá el motivo de la baja.');
      reasonRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <ModalDialog
      title={`Dar de baja a ${memberName}`}
      description="El socio no se elimina: queda inactivo con la fecha y el motivo, y se puede reactivar."
      busy={saving}
      onClose={onCancel}
    >
      <form className="modal__form" noValidate onSubmit={handleSubmit}>
        {error ? (
          <p className="form-alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-field">
          <label htmlFor={`${errorId}-reason`} className="form-field__label">
            Motivo de la baja
          </label>
          <textarea
            id={`${errorId}-reason`}
            ref={reasonRef}
            rows={3}
            required
            value={reason}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? errorId : undefined}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(undefined);
            }}
          />
          {reasonError ? (
            <p id={errorId} className="form-field__error">
              {reasonError}
            </p>
          ) : null}
        </div>
        <div className="modal__actions">
          <button type="submit" className="button button--danger" disabled={saving}>
            {saving ? 'Dando de baja…' : 'Confirmar baja'}
          </button>
          <button type="button" className="button button--secondary" disabled={saving} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

/** Simple confirmation before reactivating a member. */
export function ReactivateDialog({ memberName, saving, error, onConfirm, onCancel }: ReactivateDialogProps) {
  return (
    <ModalDialog
      role="alertdialog"
      title={`Reactivar a ${memberName}`}
      description="El socio vuelve a estar activo y se quita el registro de la baja anterior (fecha y motivo)."
      busy={saving}
      onClose={onCancel}
    >
      {error ? (
        <p className="form-alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="modal__actions">
        <button type="button" className="button button--primary" disabled={saving} onClick={onConfirm}>
          {saving ? 'Reactivando…' : 'Confirmar reactivación'}
        </button>
        <button type="button" className="button button--secondary" disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </ModalDialog>
  );
}
