import type { ReactNode } from 'react';
import type { CaptureGuideState } from '../hooks/useCaptureGuide';

const STATE_LABEL: Record<CaptureGuideState['status'], string> = {
  neutral: 'Esperando',
  adjusting: 'Ajustando',
  ready: 'Listo',
};

/**
 * Frames the camera video with an oval to place the face in, and says in large text the one thing to fix.
 * The border color follows the state (neutral, adjusting, ready) and the text says it too, so color is never the
 * only signal. The hint is a polite live region: it changes only when the hint does, so it is not read repeatedly.
 */
export function CaptureGuide({ guide, children }: { guide: CaptureGuideState; children: ReactNode }) {
  return (
    <div className="capture-guide" data-state={guide.status} data-stable={guide.stable}>
      {children}
      <div className="capture-guide__oval" aria-hidden="true" />
      <p className="capture-guide__hint" role="status" aria-live="polite" aria-atomic="true">
        {guide.hint}
      </p>
      <span className="capture-guide__state">{STATE_LABEL[guide.status]}</span>
    </div>
  );
}
