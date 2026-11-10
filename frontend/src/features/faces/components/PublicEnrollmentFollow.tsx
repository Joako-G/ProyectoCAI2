import { useState } from 'react';
import { DEFAULT_FOLLOW_INTERVAL_MS, useEnrollmentFollow } from '../hooks/useEnrollmentFollow';
import { cancelEnrollment } from '../services/enrollment-api';
import type { EnrollmentSession } from '../types/enrollment';
import { LocalCameraPreview } from './LocalCameraPreview';

/**
 * What the secretary sees while the member registers their face on the public screen: the same hint the member reads
 * there, the capture they are on, a way to cancel, and an optional look at this PC's camera. It reports how the
 * session ended through `onEnded` (`undefined` when the follow-up was lost).
 */
export function PublicEnrollmentFollow({
  initial,
  intervalMs = DEFAULT_FOLLOW_INTERVAL_MS,
  onEnded,
}: {
  initial: EnrollmentSession;
  intervalMs?: number;
  onEnded: (final: EnrollmentSession | undefined) => void;
}) {
  const session = useEnrollmentFollow({ initial, intervalMs, onEnded });
  const [previewing, setPreviewing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    setCancelling(true);
    try {
      await cancelEnrollment(session.id);
    } catch {
      // The session may already be over; the follow-up reports how it ended.
    } finally {
      setCancelling(false);
    }
  }

  const current = Math.min(session.captures + 1, session.total);

  return (
    <div className="face-enrollment__capture" role="group" aria-label="Registro en la pantalla pública">
      <p className="face-enrollment__state">Registro en la pantalla pública</p>
      {session.status === 'waiting' ? (
        <p role="status">Esperando a que {session.firstName} mire la pantalla pública…</p>
      ) : (
        <>
          <p className="face-enrollment__progress" role="status">
            Captura {current} de {session.total}
          </p>
          {session.hint ? <p className="face-enrollment__notice">La pantalla le indica a {session.firstName}: {session.hint}</p> : null}
        </>
      )}
      {previewing ? <LocalCameraPreview /> : null}
      <div className="member-detail__actions">
        <button type="button" className="button button--secondary" onClick={() => setPreviewing((on) => !on)}>
          {previewing ? 'Ocultar cámara' : 'Ver cámara'}
        </button>
        <button type="button" className="button button--danger" disabled={cancelling} onClick={() => void cancel()}>
          Cancelar registro
        </button>
      </div>
    </div>
  );
}
