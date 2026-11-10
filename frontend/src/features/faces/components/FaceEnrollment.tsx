import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_CAPTURE_TIMING, useCaptureGuide, type CaptureOutcome, type CaptureTiming } from '../hooks/useCaptureGuide';
import { useFaceCamera } from '../hooks/useFaceCamera';
import { ApiError } from '../../members/services/members-api';
import { getActiveEnrollment, getEnrollmentDisplay, openEnrollment } from '../services/enrollment-api';
import { enrollFace, getFaceStatus, removeFace } from '../services/faces-api';
import { isEnrollmentActive, type EnrollmentSession } from '../types/enrollment';
import type { FaceStatus } from '../types/face';
import { addCapture, EMPTY_PROGRESS, ENROLLMENT_CAPTURES, type EnrollmentProgress } from '../utils/enrollment-captures';
import { describeFaceApiError } from '../utils/face-messages';
import { CaptureGuide } from './CaptureGuide';
import { PublicEnrollmentFollow } from './PublicEnrollmentFollow';

const CONSENT_LABEL = 'El socio (o su tutor, si es menor) autorizó el uso de su imagen para reconocimiento facial';

/** A short rest between captures, so the person can settle before the next one. */
const DEFAULT_ENROLLMENT_TIMING: CaptureTiming = { ...DEFAULT_CAPTURE_TIMING, pauseMs: 1200 };

const INCONSISTENT_MESSAGE = 'Esa captura no coincide con las anteriores. Probemos de nuevo.';
const RESTART_MESSAGE = 'Las capturas no fueron consistentes. Empezamos de nuevo.';

/** How often the block checks whether a public screen is connected while it is idle. */
const DISPLAY_CHECK_MS = 5000;

const PUBLIC_OPEN_CONFLICT = 'No se pudo iniciar el registro: hay otro registro en curso o la pantalla pública no está conectada.';
const ENDED_MESSAGE: Record<string, string> = {
  failed: 'No se pudo registrar la cara en la pantalla pública. Intente de nuevo.',
  expired: 'Se agotó el tiempo del registro. Intente de nuevo.',
  cancelled: 'El registro se canceló.',
};
const LOST_MESSAGE = 'Se perdió el seguimiento del registro. Verifique si la cara quedó registrada.';

type Status ={ phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; status: FaceStatus };

/**
 * The "Reconocimiento facial" block of a member's record: whether a face is enrolled, and enrolling or deleting it.
 * The camera and the models load only when "Registrar cara" is pressed. Enrolling takes three captures, each only
 * when the frame is ready and consistent with the others; one descriptor, their mean, is sent. Never an image.
 * The caller shows it only to staff who hold `faces:manage`.
 */
export function FaceEnrollment({
  memberId,
  timing = DEFAULT_ENROLLMENT_TIMING,
  followIntervalMs,
}: {
  memberId: string;
  /** Overrides how often a public-screen session is polled; used by tests. */
  followIntervalMs?: number;
  /** Overrides the capture timing; used by tests. */
  timing?: CaptureTiming;
}) {
  const [status, setStatus] = useState<Status>({ phase: 'loading' });
  const [capturing, setCapturing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<string>();
  const [info, setInfo] = useState<string>();
  // A public screen is connected: the registration can be guided there, with the member looking at it.
  const [displayConnected, setDisplayConnected] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [following, setFollowing] = useState<EnrollmentSession>();
  const camera = useFaceCamera();
  const [progress, setProgress] = useState<EnrollmentProgress>();
  const [notice, setNotice] = useState<string>();
  // The handler reads the progress from here, so it never acts on a stale render.
  const progressRef = useRef<EnrollmentProgress>(EMPTY_PROGRESS);
  const running = progress !== undefined;
  const guide = useCaptureGuide({
    camera,
    active: camera.state.phase === 'ready',
    timing,
    onStable: running ? takeCapture : undefined,
  });
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

  // A session already running for this member (after a reload) is followed again.
  useEffect(() => {
    const controller = new AbortController();
    getActiveEnrollment(controller.signal).then(
      (answer) => {
        const session = answer?.session;
        if (!controller.signal.aborted && session && session.memberId === memberId && isEnrollmentActive(session.status)) setFollowing(session);
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [memberId]);

  // While idle, keep checking whether a public screen is connected.
  const idle = !capturing && !following;
  useEffect(() => {
    if (!idle) return;
    const controller = new AbortController();
    const check = () =>
      getEnrollmentDisplay(controller.signal).then(
        (answer) => !controller.signal.aborted && setDisplayConnected(answer?.connected === true),
        () => !controller.signal.aborted && setDisplayConnected(false),
      );
    void check();
    const timer = setInterval(() => void check(), DISPLAY_CHECK_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [idle]);

  function updateProgress(next: EnrollmentProgress | undefined) {
    progressRef.current = next ?? EMPTY_PROGRESS;
    setProgress(next);
  }

  function closeCamera() {
    camera.stop();
    updateProgress(undefined);
    setNotice(undefined);
    setCapturing(false);
    setChoosing(false);
    setConsent(false);
  }

  /** With a public screen connected the secretary chooses where to register; without one the camera opens here. */
  function startRegistering() {
    setMessage(undefined);
    setInfo(undefined);
    if (displayConnected) setChoosing(true);
    else openCamera();
  }

  async function startOnPublicScreen() {
    setBusy(true);
    setMessage(undefined);
    try {
      setFollowing(await openEnrollment(memberId));
      setChoosing(false);
      setConsent(false);
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 409 ? PUBLIC_OPEN_CONFLICT : describeFaceApiError(error));
    } finally {
      setBusy(false);
    }
  }

  function registerOnThisScreen() {
    setChoosing(false);
    openCamera();
  }

  /** The session ended: saved, cancelled, timed out, failed, or the follow-up was lost (`undefined`). */
  function publicEnrollmentEnded(final: EnrollmentSession | undefined) {
    setFollowing(undefined);
    if (!final) {
      setMessage(LOST_MESSAGE);
      return;
    }
    if (final.status === 'completed') {
      setInfo('Cara registrada en la pantalla pública.');
      setStatus({ phase: 'ready', status: { enrolled: true } });
      // Reads the enrollment date the server recorded.
      void getFaceStatus(memberId).then((current) => setStatus({ phase: 'ready', status: current }), () => undefined);
      return;
    }
    setMessage(ENDED_MESSAGE[final.status]);
  }

  function openCamera() {
    setMessage(undefined);
    setCapturing(true);
    void camera.start();
  }

  function startCapturing() {
    setMessage(undefined);
    setNotice(undefined);
    updateProgress(EMPTY_PROGRESS);
  }

  /** One stable, ready capture: keep it, retake it, start over, or (the third) save the mean. */
  async function takeCapture(descriptor: number[]): Promise<CaptureOutcome> {
    const result = addCapture(progressRef.current, descriptor);
    if (result.kind === 'accepted' || result.kind === 'rejected' || result.kind === 'restarted') {
      updateProgress(result.progress);
      setNotice(result.kind === 'rejected' ? INCONSISTENT_MESSAGE : result.kind === 'restarted' ? RESTART_MESSAGE : undefined);
      return 'continue';
    }
    setBusy(true);
    try {
      await enrollFace(memberId, result.descriptor);
      closeCamera();
      setStatus({ phase: 'ready', status: { enrolled: true } });
      // Reads the enrollment date the server recorded.
      void getFaceStatus(memberId).then((current) => setStatus({ phase: 'ready', status: current }), () => undefined);
    } catch (error) {
      // Back to guiding only, so the person can press the button and try again.
      updateProgress(undefined);
      setMessage(describeFaceApiError(error));
    } finally {
      setBusy(false);
    }
    return 'continue';
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

          {!capturing && !confirmingDelete && !choosing && !following ? (
            <div className="member-detail__actions">
              <button type="button" className="button button--secondary" onClick={startRegistering}>
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

      {choosing ? (
        <div className="face-enrollment__capture" role="group" aria-label="Elegir dónde registrar">
          <p>El socio verá en la pantalla pública dónde poner la cara, y usted seguirá el avance desde aquí.</p>
          <label htmlFor={consentId} className="face-enrollment__consent">
            <input id={consentId} type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
            <span>{CONSENT_LABEL}</span>
          </label>
          <div className="member-detail__actions">
            <button type="button" className="button button--primary" disabled={!consent || busy} onClick={() => void startOnPublicScreen()}>
              Registrar en la pantalla pública
            </button>
            <button type="button" className="button button--secondary" disabled={busy} onClick={registerOnThisScreen}>
              Registrar en esta pantalla
            </button>
            <button type="button" className="button button--secondary" disabled={busy} onClick={closeCamera}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {following ? <PublicEnrollmentFollow initial={following} intervalMs={followIntervalMs} onEnded={publicEnrollmentEnded} /> : null}

      {capturing ? (
        <div className="face-enrollment__capture">
          {cameraPhase === 'starting' || cameraPhase === 'ready' ? (
            <CaptureGuide guide={guide}>
              <video ref={camera.videoRef} className="face-video" muted playsInline autoPlay aria-label="Vista de la cámara" />
            </CaptureGuide>
          ) : null}
          {cameraPhase === 'starting' ? <p role="status">Preparando la cámara…</p> : null}
          {cameraPhase === 'error' ? (
            <p className="form-alert" role="alert">
              {camera.state.message}
            </p>
          ) : null}
          {progress ? (
            <p className="face-enrollment__progress" role="status">
              Captura {progress.captures.length + 1} de {ENROLLMENT_CAPTURES}
            </p>
          ) : null}
          {notice ? <p className="face-enrollment__notice">{notice}</p> : null}
          <label htmlFor={consentId} className="face-enrollment__consent">
            {/* Locked while the captures run, so what is sent always matches the consent given. */}
            <input id={consentId} type="checkbox" checked={consent} disabled={running || busy} onChange={(event) => setConsent(event.target.checked)} />
            <span>{CONSENT_LABEL}</span>
          </label>
          <div className="member-detail__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={cameraPhase !== 'ready' || !consent || busy || running}
              onClick={startCapturing}
            >
              Capturar y guardar
            </button>
            <button type="button" className="button button--secondary" onClick={closeCamera}>
              Cerrar cámara
            </button>
          </div>
        </div>
      ) : null}

      {info ? <p role="status">{info}</p> : null}
      {message ? (
        <p className="form-alert" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
