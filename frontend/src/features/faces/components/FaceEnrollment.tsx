import { useCallback, useEffect, useId, useState } from 'react';
import { useFaceCamera } from '../hooks/useFaceCamera';
import { enrollFace, getFaceStatus, removeFace } from '../services/faces-api';
import type { FaceStatus } from '../types/face';
import { describeFaceApiError, MANY_FACES_MESSAGE, NO_FACE_MESSAGE } from '../utils/face-messages';

const CONSENT_LABEL = 'El socio (o su tutor, si es menor) autorizó el uso de su imagen para reconocimiento facial';

type Status = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; status: FaceStatus };

/**
 * The "Reconocimiento facial" block of a member's record: whether a face is enrolled, and enrolling or deleting it.
 * The camera and the models load only when "Registrar cara" is pressed. Only the 128-number descriptor is sent.
 * The caller shows it only to staff who hold `faces:manage`.
 */
export function FaceEnrollment({ memberId }: { memberId: string }) {
  const [status, setStatus] = useState<Status>({ phase: 'loading' });
  const [capturing, setCapturing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<string>();
  const camera = useFaceCamera();
  const consentId = useId();

  const load = useCallback(
    (signal: AbortSignal) => {
      setStatus({ phase: 'loading' });
      getFaceStatus(memberId, signal).then(
        (current) => {
          if (!signal.aborted) setStatus({ phase: 'ready', status: current });
        },
        (error: unknown) => {
          if (!signal.aborted) setStatus({ phase: 'error', message: describeFaceApiError(error) });
        },
      );
    },
    [memberId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function closeCamera() {
    camera.stop();
    setCapturing(false);
    setConsent(false);
  }

  function openCamera() {
    setMessage(undefined);
    setCapturing(true);
    void camera.start();
  }

  async function captureAndSave() {
    setMessage(undefined);
    setBusy(true);
    try {
      const scan = await camera.scan();
      if (!scan || scan.kind === 'none') return setMessage(NO_FACE_MESSAGE);
      if (scan.kind === 'many') return setMessage(MANY_FACES_MESSAGE);
      await enrollFace(memberId, scan.descriptor);
      closeCamera();
      setStatus({ phase: 'ready', status: { enrolled: true } });
      // Reads the enrollment date the server recorded.
      void getFaceStatus(memberId).then((current) => setStatus({ phase: 'ready', status: current }), () => undefined);
    } catch (error) {
      setMessage(describeFaceApiError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFace() {
    setBusy(true);
    setMessage(undefined);
    try {
      await removeFace(memberId);
      setStatus({ phase: 'ready', status: { enrolled: false } });
    } catch (error) {
      setMessage(describeFaceApiError(error));
    } finally {
      setConfirmingDelete(false);
      setBusy(false);
    }
  }

  const cameraPhase = camera.state.phase;
  const enrolled = status.phase === 'ready' && status.status.enrolled;

  return (
    <section className="card face-enrollment" aria-label="Reconocimiento facial">
      <h3 className="face-enrollment__title">Reconocimiento facial</h3>

      {status.phase === 'loading' ? <p role="status">Cargando…</p> : null}
      {status.phase === 'error' ? (
        <p className="form-alert" role="alert">
          {status.message}
        </p>
      ) : null}

      {status.phase === 'ready' ? (
        <>
          <p className="face-enrollment__state">{enrolled ? 'Cara registrada' : 'Sin cara registrada'}</p>

          {!capturing && !confirmingDelete ? (
            <div className="member-detail__actions">
              <button type="button" className="button button--secondary" onClick={openCamera}>
                Registrar cara
              </button>
              {enrolled ? (
                <button type="button" className="button button--danger" onClick={() => setConfirmingDelete(true)}>
                  Borrar cara
                </button>
              ) : null}
            </div>
          ) : null}

          {confirmingDelete ? (
            <div className="face-enrollment__confirm" role="group" aria-label="Confirmar borrado">
              <p>¿Borrar la cara registrada? Habrá que volver a registrarla para usar el reconocimiento facial.</p>
              <div className="member-detail__actions">
                <button type="button" className="button button--danger" disabled={busy} onClick={() => void deleteFace()}>
                  Sí, borrar
                </button>
                <button type="button" className="button button--secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {capturing ? (
        <div className="face-enrollment__capture">
          {cameraPhase === 'starting' || cameraPhase === 'ready' ? (
            <video ref={camera.videoRef} className="face-video" muted playsInline autoPlay aria-label="Vista de la cámara" />
          ) : null}
          {cameraPhase === 'starting' ? <p role="status">Preparando la cámara…</p> : null}
          {cameraPhase === 'error' ? (
            <p className="form-alert" role="alert">
              {camera.state.message}
            </p>
          ) : null}
          <label htmlFor={consentId} className="face-enrollment__consent">
            <input id={consentId} type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>{CONSENT_LABEL}</span>
          </label>
          <div className="member-detail__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={cameraPhase !== 'ready' || !consent || busy}
              onClick={() => void captureAndSave()}
            >
              Capturar y guardar
            </button>
            <button type="button" className="button button--secondary" onClick={closeCamera}>
              Cerrar cámara
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="form-alert" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
