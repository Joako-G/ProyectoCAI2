import { useWelcomeEmail } from '../hooks/useWelcomeEmail';

interface WelcomeEmailSendProps {
  paymentId: string;
  /** The recipient's address, masked by the server. */
  maskedAddress: string;
}

/** Emails the welcome with the receipt PDF attached. Optional: finishing the enrollment never depends on it. */
export function WelcomeEmailSend({ paymentId, maskedAddress }: WelcomeEmailSendProps) {
  const { state, send } = useWelcomeEmail(paymentId);

  if (state.phase === 'sent') {
    return <p className="members-page__notice" role="status">Se envió el comprobante por email a {state.maskedAddress}.</p>;
  }
  return (
    <div className="welcome-email">
      <button type="button" className="button button--secondary" onClick={send} disabled={state.phase === 'sending'}>
        {state.phase === 'sending' ? 'Enviando…' : state.phase === 'failed' ? 'Reintentar envío por email' : `Enviar por email a ${maskedAddress}`}
      </button>
      {state.phase === 'failed' ? (
        <p className="members-page__notice members-page__notice--error" role="alert">No se pudo enviar el email. Puede reintentar o continuar sin enviarlo.</p>
      ) : null}
    </div>
  );
}
