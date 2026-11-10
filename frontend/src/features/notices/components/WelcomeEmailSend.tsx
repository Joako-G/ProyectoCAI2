import { useState } from 'react';
import { useWelcomeEmail } from '../hooks/useWelcomeEmail';
import type { EmailLastSend } from '../types/notice';
import { formatSentAt } from '../utils/notice-format';

interface WelcomeEmailSendProps {
  paymentId: string;
  /** The recipient's address, masked by the server. */
  maskedAddress: string;
  /** The last send the server knows, so a remounted screen does not offer a second one. */
  lastSend?: EmailLastSend;
}

/** Emails the welcome with the receipt PDF attached. Optional: finishing the enrollment never depends on it. */
export function WelcomeEmailSend({ paymentId, maskedAddress, lastSend }: WelcomeEmailSendProps) {
  const { state, send } = useWelcomeEmail(paymentId, maskedAddress, lastSend);
  const [confirming, setConfirming] = useState(false);

  const resend = () => {
    setConfirming(false);
    send(true);
  };

  if (state.phase === 'sent' || state.phase === 'uncertain' || state.phase === 'inProgress') {
    return (
      <div className="welcome-email">
        {state.phase === 'sent' ? (
          <p className="members-page__notice" role="status">
            {state.at ? `Enviado el ${formatSentAt(state.at)} a ${state.maskedAddress}.` : `Este comprobante ya fue enviado por email a ${state.maskedAddress}.`}
          </p>
        ) : state.phase === 'uncertain' ? (
          <p className="members-page__notice members-page__notice--error" role="alert">No se pudo confirmar el envío. Puede que el email ya haya llegado.</p>
        ) : (
          <p className="members-page__notice" role="status">El email de este comprobante se está enviando. Espere unos segundos.</p>
        )}
        {state.phase === 'inProgress' ? null : confirming ? (
          <div role="group" aria-label="Confirmar reenvío">
            <p className="members-page__notice">El destinatario puede recibir el comprobante dos veces. ¿Desea reenviarlo?</p>
            <button type="button" className="button button--secondary" onClick={resend}>Sí, reenviar</button>{' '}
            <button type="button" className="button button--secondary" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" className="button button--secondary" onClick={() => setConfirming(true)}>Reenviar</button>
        )}
      </div>
    );
  }
  return (
    <div className="welcome-email">
      <button type="button" className="button button--secondary" onClick={() => send()} disabled={state.phase === 'sending'}>
        {state.phase === 'sending' ? 'Enviando…' : state.phase === 'failed' ? 'Reintentar envío por email' : `Enviar por email a ${maskedAddress}`}
      </button>
      {state.phase === 'failed' ? (
        <p className="members-page__notice members-page__notice--error" role="alert">No se pudo enviar el email. Puede reintentar o continuar sin enviarlo.</p>
      ) : null}
    </div>
  );
}
