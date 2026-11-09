import { useWelcomeNotice } from '../hooks/useWelcomeNotice';
import { numberIssueLabel } from '../utils/notice-format';

interface WelcomeSendProps {
  paymentId: string;
}

/** Sends the welcome with the enrollment receipt through a WhatsApp link the secretary opens by hand. */
export function WelcomeSend({ paymentId }: WelcomeSendProps) {
  const { state, retry } = useWelcomeNotice(paymentId);

  if (state.phase === 'loading') return <p className="members-page__notice" role="status">Preparando el mensaje de bienvenida…</p>;
  if (state.phase === 'error') {
    return (
      <div className="members-page__notice members-page__notice--error" role="alert">
        <p>No se pudo preparar el mensaje de bienvenida.</p>
        <button type="button" className="button button--secondary" onClick={retry}>Reintentar</button>
      </div>
    );
  }

  const { notice } = state;
  if (!notice.link) return <p className="notice-issue" role="status">{numberIssueLabel(notice)}</p>;
  return (
    <a className="button button--secondary notice-send" href={notice.link} target="_blank" rel="noopener noreferrer" aria-label={`Enviar bienvenida por WhatsApp a ${notice.recipientName}`}>
      Enviar bienvenida por WhatsApp
    </a>
  );
}
