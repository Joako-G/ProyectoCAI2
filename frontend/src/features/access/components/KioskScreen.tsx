import type { RefObject } from 'react';
import type { KioskEnrollmentView } from '../hooks/useKioskEnrollment';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../utils/fit-scale';
import { KIOSK_TEXT, type KioskResultView } from '../utils/kiosk-texts';
import type { PaneRect } from '../utils/pane-geometry';

export type KioskPhase = 'idle' | 'identifying' | 'result' | 'unavailable' | 'expired' | 'enrolling';

export interface KioskScreenProps {
  phase: KioskPhase;
  /** What to show while a face is registered; required when the phase is `enrolling`. */
  enrollment?: KioskEnrollmentView;
  /** The panel to show; required when the phase is `result`. */
  result?: KioskResultView;
  /** `HH:MM` of the result, for the caption under the camera. */
  resultTime?: string;
  /** `HH:MM:SS` for the live clock. */
  clock: string;
  /** The live hint of the capture guide, shown under the camera while waiting. */
  hint?: string;
  /** Where the framing rectangle sits in the camera pane. */
  frame: PaneRect;
  /** Number of enrolled faces, for the comparison caption; left out when unknown. */
  enrolled?: number;
  camera: { phase: 'idle' | 'starting' | 'ready' | 'error'; message?: string };
  videoRef: RefObject<HTMLVideoElement | null>;
  /** False while the greeting stream is down. */
  connected: boolean;
  /** Uniform scale that fits the stage in the window. */
  scale: number;
  /** Where "Iniciar sesión" leads when the session has ended. */
  signInHref?: string;
}

type Tone = 'idle' | 'scanning' | 'green' | 'amber' | 'red' | 'gray' | 'dark';

function toneOf(phase: KioskPhase, result: KioskResultView | undefined): Tone {
  if (phase === 'result' && result) return result.tone;
  if (phase === 'identifying' || phase === 'enrolling') return 'scanning';
  if (phase === 'unavailable' || phase === 'expired') return 'gray';
  return 'idle';
}

function frameLabelOf(phase: KioskPhase, result: KioskResultView | undefined): string {
  if (phase === 'enrolling') return KIOSK_TEXT.enrolling.frameLabel;
  if (phase === 'result' && result) return result.frameLabel;
  if (phase === 'identifying') return KIOSK_TEXT.identifying.frameLabel;
  if (phase === 'unavailable' || phase === 'expired') return KIOSK_TEXT.outOfService.frameLabel;
  return KIOSK_TEXT.idle.frameLabel;
}

const comparingText = (enrolled: number | undefined) =>
  enrolled === undefined ? KIOSK_TEXT.identifying.comparing : `${KIOSK_TEXT.identifying.comparing} · ${enrolled} ${enrolled === 1 ? 'SOCIO' : 'SOCIOS'}`;

/**
 * The client screen, drawn at the reference size of the approved design (1180 x 700) and scaled to the window.
 * Purely presentational: the container decides the phase and brings the data.
 */
export function KioskScreen({ phase, enrollment, result, resultTime, clock, hint, frame, enrolled, camera, videoRef, connected, scale, signInHref }: KioskScreenProps) {
  const showResult = phase === 'result' && result;
  const cameraOn = camera.phase === 'starting' || camera.phase === 'ready';

  return (
    <main className="kiosk" aria-label="Pantalla de ingreso">
      <div
        className="kiosk-stage"
        data-testid="kiosk-stage"
        data-tone={toneOf(phase, result)}
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
      >
        <section className="kiosk-camera" aria-label="Cámara de acceso">
          {cameraOn ? <video ref={videoRef} className="kiosk-camera__video" muted playsInline autoPlay aria-label="Vista de la cámara" /> : null}
          {camera.phase === 'ready' ? <div className="kiosk-camera__dim" aria-hidden="true" /> : null}

          <div className="kiosk-camera__live">
            <span className="kiosk-camera__dot" />
            <span className="kiosk-mono kiosk-camera__live-text">{KIOSK_TEXT.camera.live}</span>
          </div>
          <div className="kiosk-mono kiosk-camera__clock">{clock}</div>
          {connected ? null : <div className="kiosk-mono kiosk-camera__offline">{KIOSK_TEXT.camera.offline}</div>}

          <div className="kiosk-oval-zone">
            <div className="kiosk-oval">
              <div className="kiosk-oval__ring">
                {cameraOn ? null : <span className="kiosk-mono kiosk-oval__placeholder">{KIOSK_TEXT.camera.placeholder}</span>}
              </div>
              {phase === 'identifying' ? <div className="kiosk-scan" /> : null}
            </div>
          </div>

          <div className="kiosk-frame" data-testid="kiosk-frame" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
            <span className="kiosk-frame__tab">{frameLabelOf(phase, result)}</span>
            <span className="kiosk-frame__corner kiosk-frame__corner--tl" />
            <span className="kiosk-frame__corner kiosk-frame__corner--tr" />
            <span className="kiosk-frame__corner kiosk-frame__corner--bl" />
            <span className="kiosk-frame__corner kiosk-frame__corner--br" />
          </div>

          {camera.phase === 'starting' ? <p className="kiosk-camera__notice">{KIOSK_TEXT.camera.starting}</p> : null}
          {camera.phase === 'error' ? (
            <p className="kiosk-camera__notice kiosk-camera__notice--error" role="alert">
              {camera.message}
            </p>
          ) : null}

          <div className="kiosk-caption">
            {phase === 'identifying' ? (
              <div className="kiosk-caption__progress">
                <div className="kiosk-mono kiosk-caption__row">
                  <span>{comparingText(enrolled)}</span>
                  <span>{KIOSK_TEXT.identifying.notStored}</span>
                </div>
                <div className="kiosk-bar">
                  <div className="kiosk-bar__fill" />
                </div>
              </div>
            ) : null}
            {phase === 'enrolling' ? (
              <div className="kiosk-mono kiosk-caption__row">
                <span>{KIOSK_TEXT.enrolling.label}</span>
                <span>{KIOSK_TEXT.enrolling.notStored}</span>
              </div>
            ) : null}
            {phase === 'idle' ? (
              <div className="kiosk-mono kiosk-caption__idle">{hint ? hint : KIOSK_TEXT.idle.waiting}</div>
            ) : null}
            {showResult ? (
              <div className="kiosk-mono kiosk-caption__row kiosk-caption__row--end">
                <span>{resultTime ? `${KIOSK_TEXT.registered} · ${resultTime}` : KIOSK_TEXT.registered}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="kiosk-panel" role="status" aria-live="polite">
          {phase === 'idle' ? (
            <div className="kiosk-view kiosk-view--idle" key="idle">
              <img className="kiosk-crest" src="/brand/logo-cai.png" alt="Escudo del Club Atlético Independiente" />
              <h1 className="kiosk-title kiosk-title--welcome">{KIOSK_TEXT.idle.title}</h1>
              <p className="kiosk-help">{KIOSK_TEXT.idle.help}</p>
              <p className="kiosk-note">
                {KIOSK_TEXT.idle.fallbackLead}
                <strong>{KIOSK_TEXT.idle.fallbackStrong}</strong>
                {KIOSK_TEXT.idle.fallbackRest}
              </p>
            </div>
          ) : null}

          {phase === 'enrolling' && enrollment ? (
            <div className="kiosk-view kiosk-view--enrolling" key="enrolling" data-guide={enrollment.guideStatus} data-enrollment={enrollment.status}>
              <div className="kiosk-mono kiosk-eyebrow">{KIOSK_TEXT.enrolling.label}</div>
              <h1 className="kiosk-title kiosk-title--identifying">
                {KIOSK_TEXT.enrolling.greeting}, {enrollment.firstName}
              </h1>
              <p className="kiosk-enroll__hint">{enrollment.hint}</p>
              <div className="kiosk-enroll__steps">
                <div className="kiosk-enroll__dots" aria-hidden="true">
                  {Array.from({ length: enrollment.total }, (_, index) => (
                    <span key={index} className={index < enrollment.captureNumber - (enrollment.status === 'done' ? 0 : 1) ? 'kiosk-enroll__dot kiosk-enroll__dot--done' : 'kiosk-enroll__dot'} />
                  ))}
                </div>
                <span className="kiosk-mono kiosk-enroll__count">{KIOSK_TEXT.enrolling.progress(enrollment.captureNumber, enrollment.total)}</span>
              </div>
              <p className="kiosk-note">{KIOSK_TEXT.enrolling.note}</p>
            </div>
          ) : null}

          {phase === 'identifying' ? (
            <div className="kiosk-view kiosk-view--identifying" key="identifying">
              <div className="kiosk-mono kiosk-eyebrow">{KIOSK_TEXT.identifying.label}</div>
              <h1 className="kiosk-title kiosk-title--identifying">{KIOSK_TEXT.identifying.title}</h1>
              <p className="kiosk-body">{KIOSK_TEXT.identifying.body}</p>
            </div>
          ) : null}

          {showResult ? (
            <div className="kiosk-view kiosk-view--result" key={`${result.label}-${result.title}`}>
              <div className="kiosk-result__head">
                <div className="kiosk-result__icon" aria-hidden="true">
                  {result.icon}
                </div>
                <div className="kiosk-result__heading">
                  <div className="kiosk-mono kiosk-result__label">{result.label}</div>
                  <h1 className="kiosk-title kiosk-title--result">{result.title}</h1>
                </div>
              </div>

              {result.member ? (
                <div className="kiosk-card" data-testid="kiosk-card">
                  <div className="kiosk-card__avatar" aria-hidden="true">
                    {result.member.initials}
                  </div>
                  <div className="kiosk-card__body">
                    <div className="kiosk-card__name">{result.member.name}</div>
                    <div className="kiosk-card__facts">
                      <div className="kiosk-card__fact">
                        <span className="kiosk-mono kiosk-card__fact-label">N° SOCIO</span>
                        <span className="kiosk-mono kiosk-card__fact-value">{result.member.number}</span>
                      </div>
                      <div className="kiosk-card__fact">
                        <span className="kiosk-mono kiosk-card__fact-label">CUOTA</span>
                        <span className="kiosk-mono kiosk-card__fact-value kiosk-card__fee">{result.member.fee}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="kiosk-result__text">
                <p className="kiosk-result__message">{result.message}</p>
                {result.detail ? (
                  <div className="kiosk-detail">
                    <span className="kiosk-detail__label">{result.detail.label}</span>
                    <span className="kiosk-mono kiosk-detail__value">{result.detail.value}</span>
                  </div>
                ) : null}
              </div>

              <div className="kiosk-mono kiosk-footer">{result.footer}</div>
            </div>
          ) : null}

          {phase === 'unavailable' || phase === 'expired' ? (
            <div className="kiosk-view kiosk-view--result" key={phase}>
              <div className="kiosk-result__head">
                <div className="kiosk-result__icon" aria-hidden="true">
                  {KIOSK_TEXT.outOfService.icon}
                </div>
                <div className="kiosk-result__heading">
                  <div className="kiosk-mono kiosk-result__label">{KIOSK_TEXT.outOfService.label}</div>
                  <h1 className="kiosk-title kiosk-title--result">{phase === 'expired' ? KIOSK_TEXT.sessionExpired : KIOSK_TEXT.unavailable}</h1>
                </div>
              </div>
              {phase === 'expired' && signInHref ? (
                <a className="kiosk-signin" href={signInHref}>
                  {KIOSK_TEXT.signIn}
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
