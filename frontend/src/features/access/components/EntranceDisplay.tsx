import { useEffect, useState } from 'react';
import { defaultCreateSource, useGreetingStream, type GreetingSource } from '../hooks/useGreetingStream';
import { greetingText } from '../utils/greeting-format';

/** How long a greeting stays on the screen before it goes back to the welcome. */
export const DEFAULT_HOLD_MS = 7000;
const DEFAULT_RECONNECT_MS = 3000;

interface EntranceDisplayProps {
  /** Overrides EventSource; used by tests. */
  createSource?: (url: string) => GreetingSource;
  holdMs?: number;
  reconnectMs?: number;
}

/**
 * The public screen of the entrance: a large greeting for a few seconds after each check, then a welcome.
 * It shows the first name and a tone, never a number, a debt or a reason. Opened full screen in its own window.
 */
export function EntranceDisplay({ createSource = defaultCreateSource, holdMs = DEFAULT_HOLD_MS, reconnectMs = DEFAULT_RECONNECT_MS }: EntranceDisplayProps) {
  const { latest, connected } = useGreetingStream({ createSource, reconnectMs });
  const [shown, setShown] = useState<typeof latest>();

  // Each new greeting replaces the one on screen and restarts the time it stays.
  useEffect(() => {
    if (!latest) return;
    setShown(latest);
    const timer = setTimeout(() => setShown(undefined), holdMs);
    return () => clearTimeout(timer);
  }, [latest, holdMs]);

  const tone = shown?.event.tone;
  return (
    <main className={`entrance-display entrance-display--${tone ?? 'idle'}`} aria-label="Pantalla de ingreso">
      <div role="status" aria-live="polite" className="entrance-display__message">
        <p className="entrance-display__text">{shown ? greetingText(shown.event) : 'Bienvenidos al club'}</p>
      </div>
      {connected ? null : <p className="entrance-display__offline">Reconectando…</p>}
    </main>
  );
}
