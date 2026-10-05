import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface ModalDialogProps {
  role?: 'dialog' | 'alertdialog';
  title: string;
  description: string;
  /** Escape closes the dialog unless this is true (e.g. while a request is in flight). */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href]';

/**
 * Accessible modal: labelled and described, moves focus in on open, traps Tab, closes on Escape and
 * returns focus to the element that opened it.
 */
export function ModalDialog({ role = 'dialog', title, description, busy = false, onClose, children }: ModalDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // Disabling the focused control (busy) would drop focus to <body> and lose the key handlers, so park it on
  // the dialog itself; when busy ends, hand it back to the first control.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const active = document.activeElement;
    if (busy) {
      if (active === document.body || (active instanceof HTMLElement && active.matches(':disabled'))) dialog.focus();
    } else if (active === dialog) {
      dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
  }, [busy]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) {
      // Every control is disabled (busy): keep focus parked on the dialog instead of letting Tab escape it.
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (document.activeElement === dialogRef.current) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="modal"
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        <p id={descriptionId} className="modal__description">
          {description}
        </p>
        {children}
      </div>
    </div>
  );
}
