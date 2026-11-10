import { useEffect, useRef, useState } from 'react';
import { faceTools } from '../services/face-tools';

/**
 * A read-only look at this PC's camera, so the secretary at the front desk sees where the member's face is. It only
 * shows the video: no detector is loaded and nothing is analyzed or sent. The stream is released when it closes.
 * A PC without a camera simply says so.
 */
export function LocalCameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'ready' | 'error'>('starting');

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    faceTools.openCamera().then(
      (opened) => {
        if (cancelled) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        if (videoRef.current) videoRef.current.srcObject = opened;
        setState('ready');
      },
      () => {
        if (!cancelled) setState('error');
      },
    );
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="face-enrollment__preview">
      <video ref={videoRef} className="face-video" muted playsInline autoPlay aria-label="Vista previa de la cámara" hidden={state !== 'ready'} />
      {state === 'starting' ? <p role="status">Preparando la cámara…</p> : null}
      {state === 'error' ? <p role="status">No hay una cámara disponible en esta PC. Siga el avance con los datos de arriba.</p> : null}
    </div>
  );
}
